import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleCheck, CircleX } from "lucide-react";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import ChartCard from "../components/ChartCard";
import Tabs from "../components/Tabs";
import Modal from "../components/Modal";
import { groupByMonth, groupByKey, isToday } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");
  const [form, setForm] = useState({ vehicle_id: "", driver_id: "", trip_number: "", destination: "", departure_time: "" });
  const { error: loadError, debug: loadDebug, handleError: handleLoadError } = useErrorHandler();
  const { user } = useAuth();
  const canCreate = can(user?.role, "tripCreate");
  const canUpdate = can(user?.role, "tripUpdate");

  const load = () => api.get("/trips").then((r) => setTrips(r.data)).catch((e) => handleLoadError(e, "Failed to load trips"));
  useEffect(() => {
    load();
    // Drivers can only create trips on the vehicle already assigned to them
    // (which is NOT "available"), so don't apply the available filter for them.
    const vehicleParams = user?.role === "driver" ? {} : { status_filter: "available" };
    api.get("/vehicles", { params: vehicleParams }).then((r) => setVehicles(r.data)).catch(() => {});
    api.get("/drivers").then((r) => setDrivers(r.data)).catch(() => {});
  }, []);

  const [allVehicles, setAllVehicles] = useState([]);
  useEffect(() => { api.get("/vehicles").then((r) => setAllVehicles(r.data)).catch(() => {}); }, [trips]);

  const vehicleName = (id) => allVehicles.find((v) => v.id === id)?.plate_number || "—";
  const driverName = (id) => drivers.find((d) => d.id === id)?.full_name || "—";

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/trips", { ...form, departure_time: new Date(form.departure_time).toISOString() });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not log trip");
    }
  };

  const setStatus = async (id, trip_status) => {
    try { await api.patch(`/trips/${id}/status`, { trip_status }); load(); }
    catch (err) { handleLoadError(err, "Failed to update trip status"); }
  };

  const tabFiltered = trips.filter((t) => {
    if (tab === "scheduled") return t.trip_status === "scheduled";
    if (tab === "active") return t.trip_status === "active";
    if (tab === "completed") return t.trip_status === "completed" || t.trip_status === "cancelled";
    return true;
  });
  const filtered = tabFiltered.filter((t) =>
    `${t.trip_number} ${driverName(t.driver_id)}`.toLowerCase().includes(search.toLowerCase())
  );

  const tripsByMonth = groupByMonth(trips, "departure_time");
  const tripsByDestination = groupByKey(trips, (t) => t.destination, 6);

  const stats = {
    today: trips.filter((t) => isToday(t.departure_time)).length,
    completed: trips.filter((t) => t.trip_status === "completed").length,
    cancelled: trips.filter((t) => t.trip_status === "cancelled").length,
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
          <p className="text-gray-500 text-sm">{stats.today} active trips today</p>
        </div>
        {canCreate ? (
          <button onClick={() => setModalOpen(true)} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
            + Log trip
          </button>
        ) : (
          <span className="text-xs text-gray-400 self-center">View only</span>
        )}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "scheduled", label: "Scheduled" },
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
        ]}
      />

      {loadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {loadError}
          {loadDebug && <div className="text-xs text-red-400 mt-1">{loadDebug}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={CalendarDays} iconBg="bg-navy-100" iconColor="text-navy-700" value={stats.today} label="Trips Today" />
        <StatCard icon={CircleCheck} iconBg="bg-green-100" iconColor="text-green-700" value={stats.completed} label="Completed Trips" />
        <StatCard icon={CircleX} iconBg="bg-red-100" iconColor="text-red-700" value={stats.cancelled} label="Cancelled Trips" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Trips by Month" subtitle="Line chart">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={tripsByMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3d67a8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Trips by Destination" subtitle="Bar chart · top 6">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={tripsByDestination}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search trip number, driver…"
        className="w-full mb-4 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm"
      />

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
            <tr>
              <th className="px-6 py-3">Trip Number</th>
              <th className="px-6 py-3">Driver</th>
              <th className="px-6 py-3">Vehicle</th>
              <th className="px-6 py-3">Destination</th>
              <th className="px-6 py-3">Status</th>
              {canUpdate && <th className="px-6 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-16 text-gray-400">No trips found.</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="px-6 py-4 font-medium text-gray-900">{t.trip_number}</td>
                <td className="px-6 py-4 text-gray-600">{driverName(t.driver_id)}</td>
                <td className="px-6 py-4 text-gray-600">{vehicleName(t.vehicle_id)}</td>
                <td className="px-6 py-4 text-gray-600">{t.destination}</td>
                <td className="px-6 py-4"><StatusBadge status={t.trip_status} /></td>
                {canUpdate && (
                  <td className="px-6 py-4 text-right space-x-3">
                    {t.trip_status === "scheduled" && (
                      <button onClick={() => setStatus(t.id, "active")} className="text-navy-700 text-xs font-semibold hover:text-navy-900">Start</button>
                    )}
                    {t.trip_status === "active" && (
                      <button onClick={() => setStatus(t.id, "completed")} className="text-green-600 text-xs font-medium">Complete</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Trip">
        <form onSubmit={save}>
          {error && <div className="text-red-600 text-xs mb-3">{error}</div>}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Vehicle</label>
              <select required value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
                <option value="">Select available vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.brand} {v.model}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Driver</label>
              <select required value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
                <option value="">Select driver</option>
                {drivers.filter((d) => d.status === "active").map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Trip Number</label>
              <input required value={form.trip_number} onChange={(e) => setForm({ ...form, trip_number: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="TR-0516" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Destination</label>
              <input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Departure Time</label>
              <input required type="datetime-local" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <button type="submit" className="w-full mt-5 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            Log trip
          </button>
        </form>
      </Modal>
    </div>
  );
}
