import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import api from "../api/client";
import ChartCard from "../components/ChartCard";
import Tabs from "../components/Tabs";
import { groupByMonth, groupByKey, toCSV, downloadCSV } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";

const STATUS_COLORS = { available: "#10b981", assigned: "#3d67a8", maintenance: "#f59e0b", inactive: "#9ca3af", retired: "#ef4444" };

export default function Reports() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [tab, setTab] = useState("fleet");
  const { error, debug, handleError } = useErrorHandler();

  useEffect(() => {
    Promise.all([api.get("/vehicles"), api.get("/trips"), api.get("/maintenance"), api.get("/fuel-logs")])
      .then(([v, t, m, f]) => { setVehicles(v.data); setTrips(t.data); setMaintenance(m.data); setFuelLogs(f.data); })
      .catch((e) => handleError(e, "Failed to load report data"));
  }, []);

  const statusCounts = vehicles.reduce((acc, v) => { acc[v.status] = (acc[v.status] || 0) + 1; return acc; }, {});
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const utilData = [
    { name: "Available", value: statusCounts.available || 0 },
    { name: "Assigned", value: statusCounts.assigned || 0 },
    { name: "Maintenance", value: statusCounts.maintenance || 0 },
  ];

  const costByMonth = groupByMonth(maintenance.filter((m) => m.cost != null), "scheduled_date", (m) => Number(m.cost));
  const freqByVehicle = groupByKey(maintenance, (m) => vehicles.find((v) => v.id === m.vehicle_id)?.plate_number, 6);

  const fuelByMonth = groupByMonth(fuelLogs, "fuel_date", (f) => Number(f.cost));
  const fuelByVehicle = (() => {
    const map = new Map();
    fuelLogs.forEach((f) => {
      const p = vehicles.find((v) => v.id === f.vehicle_id)?.plate_number || "—";
      map.set(p, (map.get(p) || 0) + Number(f.cost));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  })();

  const tripsByMonth = groupByMonth(trips, "departure_time");
  const tripsByDestination = groupByKey(trips, (t) => t.destination, 6);

  const exportCurrent = () => {
    let csv;
    if (tab === "fleet") csv = toCSV(vehicles, [
      { label: "Plate", get: (v) => v.plate_number }, { label: "Type", get: (v) => v.vehicle_type },
      { label: "Status", get: (v) => v.status },
    ]);
    else if (tab === "maintenance") csv = toCSV(maintenance, [
      { label: "Vehicle", get: (m) => vehicles.find((v) => v.id === m.vehicle_id)?.plate_number },
      { label: "Type", get: (m) => m.maintenance_type }, { label: "Scheduled", get: (m) => m.scheduled_date },
      { label: "Status", get: (m) => m.maintenance_status }, { label: "Cost", get: (m) => m.cost },
    ]);
    else if (tab === "fuel") csv = toCSV(fuelLogs, [
      { label: "Vehicle", get: (f) => vehicles.find((v) => v.id === f.vehicle_id)?.plate_number },
      { label: "Date", get: (f) => f.fuel_date }, { label: "Liters", get: (f) => f.liters }, { label: "Cost", get: (f) => f.cost },
    ]);
    else csv = toCSV(trips, [
      { label: "Trip Number", get: (t) => t.trip_number }, { label: "Destination", get: (t) => t.destination },
      { label: "Departure", get: (t) => t.departure_time }, { label: "Status", get: (t) => t.trip_status },
    ]);
    downloadCSV(`${tab}-report.csv`, csv);
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm">Generate and export fleet operations reports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCurrent} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">Export CSV</button>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">Print</button>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "fleet", label: "Fleet Reports" },
          { value: "maintenance", label: "Maintenance Reports" },
          { value: "fuel", label: "Fuel Reports" },
          { value: "trip", label: "Trip Reports" },
        ]}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      )}

      {tab === "fleet" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Fleet Utilization" subtitle="Available vs. assigned vs. maintenance">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={utilData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3d67a8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Vehicle Status Mix" subtitle="Current snapshot">
            <div className="flex flex-wrap items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={2}>
                    {pieData.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name] || "#d1d5db"} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="text-sm space-y-1 capitalize">
                {pieData.map((e) => <li key={e.name}>{e.name}: {e.value}</li>)}
              </ul>
            </div>
          </ChartCard>
        </div>
      )}

      {tab === "maintenance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Maintenance Cost Trend" subtitle="₱ per month">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={costByMonth}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Frequency by Vehicle" subtitle="Services on record">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={freqByVehicle}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {tab === "fuel" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Fuel Cost Trend" subtitle="₱ per month">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={fuelByMonth}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top Vehicles by Fuel Cost" subtitle="₱ total">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={fuelByVehicle}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3d67a8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {tab === "trip" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Trips by Month" subtitle="Line chart">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={tripsByMonth}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#3d67a8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Trips by Destination" subtitle="Bar chart · top 6">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tripsByDestination}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
