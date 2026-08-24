import { useEffect, useState } from "react";
import { Truck, Car, Wrench, Users, Phone } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import api from "../api/client";
import StatCard from "../components/StatCard";
import ChartCard from "../components/ChartCard";
import Tabs from "../components/Tabs";
import StatusBadge from "../components/StatusBadge";
import { groupByMonth, fmtDate } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { StatCardSkeleton, Skeleton } from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";

const STATUS_COLORS = { available: "#10b981", assigned: "#3d67a8", maintenance: "#f59e0b", inactive: "#9ca3af", retired: "#ef4444" };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [tab, setTab] = useState("overview");
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/summary"),
      api.get("/vehicles"),
      api.get("/drivers"),
      api.get("/trips"),
      api.get("/maintenance"),
      api.get("/fuel-logs"),
    ]).then(([s, v, d, t, m, f]) => {
      setData(s.data); setVehicles(v.data); setDrivers(d.data);
      setTrips(t.data); setMaintenance(m.data); setFuelLogs(f.data);
    }).catch((e) => handleError(e, "Failed to load dashboard data"));
  }, []);

  if (!data) {
    if (error) return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      </div>
    );
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  const pieData = Object.entries(data.vehicle_status_distribution).map(([status, count]) => ({ name: status, value: count }));
  const tripsByMonth = groupByMonth(trips, "departure_time");
  const maintenanceByMonth = groupByMonth(maintenance, "scheduled_date");
  const fuelByMonth = groupByMonth(fuelLogs, "fuel_date", (f) => Number(f.cost));

  const overdueMaintenance = maintenance.filter((m) => m.maintenance_status === "pending" && new Date(m.scheduled_date) < new Date());
  const flaggedDrivers = drivers.filter((d) => ["suspended", "inactive"].includes(d.status));
  const vehiclesInMaintenance = vehicles.filter((v) => v.status === "maintenance");

  const recentActivity = [
    ...trips.map((t) => ({ ts: t.departure_time, user: "—", action: "Logged trip", entity: t.trip_number, status: t.trip_status })),
    ...maintenance.map((m) => ({ ts: m.scheduled_date, user: "—", action: "Scheduled maintenance", entity: m.maintenance_type, status: m.maintenance_status })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8);

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Overview of fleet operations and key metrics</p>
        </div>
        {user?.role === "administrator" && user?.organization_id && (
          <div className="bg-white rounded-xl shadow-sm p-4 text-right max-w-xs">
            <p className="text-xs text-gray-400 mb-1">Your Organization ID</p>
            <p className="text-sm font-mono font-medium text-gray-900 break-all">{user.organization_id}</p>
            <p className="text-xs text-gray-400 mt-1">Share with team members to join</p>
          </div>
        )}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "alerts", label: "Alerts" },
          { value: "activity", label: "Recent Activity" },
        ]}
      />

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard icon={Truck} iconBg="bg-navy-100" iconColor="text-navy-700" value={data.total_vehicles} label="Total Vehicles" />
            <StatCard icon={Car} iconBg="bg-green-100" iconColor="text-green-700" value={data.active_vehicles} label="Active Vehicles" />
            <StatCard icon={Wrench} iconBg="bg-amber-100" iconColor="text-amber-700" value={data.vehicles_in_maintenance} label="Vehicles in Maintenance" />
            <StatCard icon={Users} iconBg="bg-purple-100" iconColor="text-purple-700" value={data.active_drivers} label="Active Drivers" />
            <StatCard icon={Phone} iconBg="bg-navy-100" iconColor="text-navy-700" value={data.active_trips} label="Active Trips" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <ChartCard title="Vehicle Status Distribution" subtitle="Pie chart · by current status">
              <div className="flex flex-wrap items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {pieData.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name] || "#d1d5db"} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <ul className="text-sm space-y-1">
                  {pieData.map((e) => (
                    <li key={e.name} className="flex items-center gap-2 capitalize">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[e.name] || "#d1d5db" }} />
                      {e.name} — {e.value}
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>
            <ChartCard title="Monthly Fuel Cost" subtitle="Last 30 days">
              <div className="text-3xl font-bold text-gray-900">₱{Number(data.monthly_fuel_cost).toLocaleString()}</div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Monthly Trip Count" subtitle="Line chart · recent months">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={tripsByMonth}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3d67a8" fill="#dbeafe" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Maintenance Trend" subtitle="Bar chart · services per month">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={maintenanceByMonth}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Fuel Cost Trend" subtitle="Line chart · ₱ per month">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={fuelByMonth}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      {tab === "alerts" && (
        <div className="space-y-4">
          <ChartCard title="Overdue Maintenance" subtitle={`${overdueMaintenance.length} record(s) past scheduled date`}>
            {overdueMaintenance.length === 0 ? <div className="text-sm text-gray-400">Nothing overdue.</div> :
              <ul className="text-sm space-y-2">
                {overdueMaintenance.map((m) => (
                  <li key={m.id} className="flex justify-between border-b border-gray-100 pb-2">
                    <span>{m.maintenance_type} — scheduled {fmtDate(m.scheduled_date)}</span>
                    <StatusBadge status={m.maintenance_status} />
                  </li>
                ))}
              </ul>}
          </ChartCard>
          <ChartCard title="Drivers Needing Attention" subtitle={`${flaggedDrivers.length} suspended or inactive`}>
            {flaggedDrivers.length === 0 ? <div className="text-sm text-gray-400">No flagged drivers.</div> :
              <ul className="text-sm space-y-2">
                {flaggedDrivers.map((d) => (
                  <li key={d.id} className="flex justify-between border-b border-gray-100 pb-2">
                    <span>{d.full_name} ({d.employee_number})</span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>}
          </ChartCard>
          <ChartCard title="Vehicles in Maintenance" subtitle={`${vehiclesInMaintenance.length} currently out of service`}>
            {vehiclesInMaintenance.length === 0 ? <div className="text-sm text-gray-400">All vehicles active.</div> :
              <ul className="text-sm space-y-2">
                {vehiclesInMaintenance.map((v) => (
                  <li key={v.id} className="flex justify-between border-b border-gray-100 pb-2">
                    <span>{v.plate_number} — {v.brand} {v.model}</span>
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>}
          </ChartCard>
        </div>
      )}

      {tab === "activity" && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Entity</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 && <tr><td colSpan={4} className="text-center py-16 text-gray-400">No recent activity.</td></tr>}
              {recentActivity.map((a, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-6 py-4 text-gray-500">{fmtDate(a.ts)}</td>
                  <td className="px-6 py-4 text-gray-900">{a.action}</td>
                  <td className="px-6 py-4 text-gray-600">{a.entity}</td>
                  <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
