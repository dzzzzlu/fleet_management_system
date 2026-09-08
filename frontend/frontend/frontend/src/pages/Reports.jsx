import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, Wrench, Fuel as FuelIcon, Phone, Download, Printer, MousePointerClick } from "lucide-react";
import api from "../api/client";
import ChartCard from "../components/ChartCard";
import StatCard from "../components/StatCard";
import Tabs from "../components/Tabs";
import { groupByMonth, groupByKey, toCSV, downloadCSV } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useAuth } from "../auth/AuthContext";

const STATUS_COLORS = { available: "#10b981", assigned: "#3d67a8", maintenance: "#f59e0b", inactive: "#9ca3af", retired: "#ef4444" };

export default function Reports() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [tab, setTab] = useState("fleet");
  const [chartMode, setChartMode] = useState("bar"); // bar | line | area
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();
  const isDriver = user?.role === "driver";

  useEffect(() => {
    if (isDriver) {
      setTab("trip");
      Promise.all([
        api.get("/trips").catch(() => ({ data: [] })),
        api.get("/maintenance").catch(() => ({ data: [] })),
      ])
        .then(([t, m]) => { setTrips(t.data); setMaintenance(m.data); })
        .catch((e) => handleError(e, "Failed to load report data"));
    } else {
      Promise.all([api.get("/vehicles"), api.get("/trips"), api.get("/maintenance"), api.get("/fuel-logs")])
        .then(([v, t, m, f]) => { setVehicles(v.data); setTrips(t.data); setMaintenance(m.data); setFuelLogs(f.data); })
        .catch((e) => handleError(e, "Failed to load report data"));
    }
  }, []);

  const statusCounts = vehicles.reduce((acc, v) => { acc[v.status] = (acc[v.status] || 0) + 1; return acc; }, {});
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const fleetTotal = vehicles.length || 1;

  const fuelByMonth = groupByMonth(fuelLogs, "fuel_date", (f) => Number(f.cost));
  const fuelByVehicle = (() => {
    const map = new Map();
    fuelLogs.forEach((f) => {
      const p = vehicles.find((v) => v.id === f.vehicle_id)?.plate_number || "—";
      map.set(p, (map.get(p) || 0) + Number(f.cost));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  })();

  const tripsByMonth = groupByMonth(trips, "departure_time");
  const tripsByDestination = groupByKey(trips, (t) => t.destination, 5);
  const maintenanceByMonth = groupByMonth(maintenance.filter((m) => m.cost != null), "scheduled_date", (m) => Number(m.cost));

  const kpis = useMemo(() => ({
    activeFleet: (statusCounts.available || 0) + (statusCounts.assigned || 0),
    maintenance: statusCounts.maintenance || 0,
    totalFuel: fuelLogs.reduce((s, f) => s + Number(f.cost || 0), 0),
    totalTrips: trips.length,
  }), [statusCounts, fuelLogs, trips]);

  const Chart = ({ data, dataKey, color, height = 200 }) => {
    if (!data || data.length === 0) return <div className="text-sm text-gray-400 py-10 text-center">No data yet.</div>;
    return (
      <ResponsiveContainer width="100%" height={height}>
        {chartMode === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} name="value" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        ) : chartMode === "area" ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey={dataKey} name="value" stroke={color} strokeWidth={2.5} fill={`url(#grad-${color.replace("#", "")})`} />
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey={dataKey} name="value" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 text-sm">Interactive fleet insights — tap a chart style to compare</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5 mr-1" title="Chart style">
            <MousePointerClick size={15} className="text-gray-400 mr-1" aria-hidden />
            {(["bar", "line", "area"]).map((mode) => (
              <button key={mode} onClick={() => setChartMode(mode)}
                className={`text-xs uppercase px-2.5 py-1 rounded-md font-semibold transition-colors ${chartMode === mode ? "bg-navy-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {mode}
              </button>
            ))}
          </div>
          <button onClick={exportCurrent} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">
            <Download size={14} aria-hidden /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">
            <Printer size={14} aria-hidden /> Print
          </button>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={isDriver
          ? [
              { value: "trip", label: "Trip Reports" },
              { value: "maintenance", label: "Maintenance Reports" },
            ]
          : [
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <StatCard icon={TrendingUp} iconBg="bg-navy-100" iconColor="text-navy-700" value={kpis.activeFleet} label="Active Vehicles" />
        <StatCard icon={Phone} iconBg="bg-blue-100" iconColor="text-blue-700" value={kpis.totalTrips} label="Total Trips" />
        <StatCard icon={Wrench} iconBg="bg-amber-100" iconColor="text-amber-700" value={kpis.maintenance} label="In Maintenance" />
        <StatCard icon={FuelIcon} iconBg="bg-purple-100" iconColor="text-purple-700" value={`₱${kpis.totalFuel.toLocaleString()}`} label="Total Fuel Spend" />
      </div>

      {tab === "fleet" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Fleet Utilization" subtitle="Available vs. assigned vs. maintenance">
            <Chart data={[{ name: "Available", value: statusCounts.available || 0 }, { name: "Assigned", value: statusCounts.assigned || 0 }, { name: "Maintenance", value: statusCounts.maintenance || 0 }]} dataKey="value" color="#3d67a8" />
          </ChartCard>
          <ChartCard title="Vehicle Status Mix" subtitle="Share of the fleet by status">
            <div className="flex flex-wrap items-center justify-center gap-6">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name] || "#d1d5db"} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {pieData.map((e) => (
                  <div key={e.name} className="flex items-center gap-2 text-sm capitalize">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[e.name] || "#d1d5db" }} />
                    <span className="text-gray-600">{e.name}</span>
                    <span className="font-semibold text-gray-900">{e.value} <span className="text-gray-400 text-xs font-normal">({Math.round((e.value / fleetTotal) * 100)}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      )}

      {tab === "maintenance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Maintenance Cost Trend" subtitle="₱ per month · click a tab above to switch style">
            <Chart data={maintenanceByMonth} dataKey="value" color="#f59e0b" />
          </ChartCard>
          <ChartCard title="Services by Vehicle" subtitle="Top 5 most-serviced">
            <Chart data={groupByKey(maintenance, (m) => vehicles.find((v) => v.id === m.vehicle_id)?.plate_number, 5)} dataKey="value" color="#10b981" />
          </ChartCard>
        </div>
      )}

      {tab === "fuel" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Fuel Cost Trend" subtitle="₱ per month">
              <Chart data={fuelByMonth} dataKey="value" color="#ef4444" />
            </ChartCard>
            <ChartCard title="Total Cost by Vehicle" subtitle="Top 5 fuel consumers"><Chart data={fuelByVehicle} dataKey="value" color="#8b5cf6" /></ChartCard>
          </div>
          <div className="mt-4 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">Top Fuel Consumers</div>
            <div className="divide-y divide-gray-100">
              {fuelByVehicle.map((fv, i) => (
                <div key={fv.name} className="flex items-center gap-4 px-6 py-3">
                  <span className="w-6 text-sm font-bold text-gray-400">#{i + 1}</span>
                  <span className="w-24 font-medium text-gray-900">{fv.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((fv.value / (fuelByVehicle[0]?.value || 1)) * 100)}%`, background: "#8b5cf6" }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">₱{Number(fv.value).toLocaleString()}</span>
                </div>
              ))}
              {fuelByVehicle.length === 0 && <div className="px-6 py-8 text-sm text-gray-400 text-center">No fuel data yet.</div>}
            </div>
          </div>
        </>
      )}

      {tab === "trip" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Trips by Month" subtitle="Volume over time">
            <Chart data={tripsByMonth} dataKey="value" color="#3d67a8" />
          </ChartCard>
          <ChartCard title="Top Destinations" subtitle="Most frequent routes · top 5">
            <Chart data={tripsByDestination} dataKey="value" color="#f59e0b" />
          </ChartCard>
        </div>
      )}
    </div>
  );
}