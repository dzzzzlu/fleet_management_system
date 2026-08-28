import { useEffect, useState } from "react";
import { Fuel, Banknote, Wrench, CarFront, Clock3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import ChartCard from "../components/ChartCard";
import Tabs from "../components/Tabs";
import Modal from "../components/Modal";
import { groupByMonth, fmtDate } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

const EMPTY_FUEL = { vehicle_id: "", driver_id: "", fuel_date: "", liters: "", cost: "", odometer: "", station: "" };

export default function Maintenance() {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [tab, setTab] = useState("pending");
  const [modalOpen, setModalOpen] = useState(false);
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_id: "", maintenance_type: "", scheduled_date: "" });
  const [fuelForm, setFuelForm] = useState(EMPTY_FUEL);
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();
  const canCreateMaint = can(user?.role, "maintenanceCreate");
  const canUpdate = can(user?.role, "maintenanceUpdate");
  // Any role with maintenance.update (staff/manager/admin) may change the
  // status of a maintenance record; the backend enforces this too.
  const isDriver = user?.role === "driver";

  const load = () => api.get("/maintenance").then((r) => setRecords(r.data)).catch((e) => handleError(e, "Failed to load maintenance records"));
  const loadFuel = () => api.get("/fuel-logs").then((r) => setFuelLogs(r.data)).catch((e) => handleError(e, "Failed to load fuel logs"));
  useEffect(() => {
    load();
    loadFuel();
    api.get("/vehicles").then((r) => setVehicles(r.data)).catch(() => {});
    api.get("/drivers").then((r) => setDrivers(r.data)).catch(() => {});
  }, []);

  const saveFuel = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...fuelForm,
        driver_id: fuelForm.driver_id || null,
        liters: Number(fuelForm.liters),
        cost: Number(fuelForm.cost),
        odometer: fuelForm.odometer ? Number(fuelForm.odometer) : null,
      };
      await api.post("/fuel-logs", payload);
      setFuelModalOpen(false);
      setFuelForm(EMPTY_FUEL);
      loadFuel();
    } catch (err) {
      handleError(err, "Failed to save fuel log");
    }
  };

  const plate = (id) => vehicles.find((v) => v.id === id)?.plate_number || "—";

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/maintenance", form);
      setModalOpen(false);
      load();
    } catch (err) {
      handleError(err, "Failed to schedule maintenance");
    }
  };

  const changeStatus = async (id, maintenance_status) => {
    try {
      const payload = { maintenance_status };
      if (maintenance_status === "completed") {
        payload.completed_date = new Date().toISOString().slice(0, 10);
      }
      await api.patch(`/maintenance/${id}/status`, payload);
      load();
    } catch (err) {
      handleError(err, "Failed to update maintenance status");
    }
  };

  const filtered = records.filter((r) => r.maintenance_status === tab);
  const costByMonth = groupByMonth(records.filter((r) => r.cost != null), "scheduled_date", (r) => Number(r.cost));
  const freqByVehicle = (() => {
    const map = new Map();
    records.forEach((r) => map.set(plate(r.vehicle_id), (map.get(plate(r.vehicle_id)) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  })();

  const completedWithDates = records.filter((r) => r.maintenance_status === "completed" && r.completed_date);
  const avgDowntime = completedWithDates.length
    ? (completedWithDates.reduce((sum, r) => sum + (new Date(r.completed_date) - new Date(r.scheduled_date)) / 86400000, 0) / completedWithDates.length).toFixed(1)
    : "0";

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-gray-500 text-sm">{records.filter((r) => r.maintenance_status === "pending").length} pending</p>
        </div>
        <div className="space-x-2">
          {canCreateMaint ? (
            tab === "fuel_logs" ? (
              <button onClick={() => setFuelModalOpen(true)} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
                + Add fuel log
              </button>
            ) : (
              <button onClick={() => setModalOpen(true)} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
                + Schedule maintenance
              </button>
            )
          ) : (
            <span className="text-xs text-gray-400 self-center">View only</span>
          )}
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "pending", label: "Scheduled" },
          { value: "in_progress", label: "Ongoing" },
          { value: "completed", label: "Completed" },
          ...(!isDriver ? [{ value: "fuel_logs", label: "Fuel Logs" }] : []),
        ]}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      )}

      {tab === "fuel_logs" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <StatCard icon={Fuel} iconBg="bg-navy-100" iconColor="text-navy-700" value={fuelLogs.length} label="Total Fuel Logs" />
            <StatCard icon={Banknote} iconBg="bg-green-100" iconColor="text-green-700" value={`₱${fuelLogs.reduce((s, f) => s + Number(f.cost), 0).toFixed(2)}`} label="Total Fuel Cost" />
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
                <tr>
                  <th className="px-6 py-3">Vehicle</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Liters</th>
                  <th className="px-6 py-3">Cost</th>
                  <th className="px-6 py-3">Station</th>
                </tr>
              </thead>
              <tbody>
                {fuelLogs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400">No fuel logs yet.</td></tr>
                )}
                {fuelLogs.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100">
                    <td className="px-6 py-4 font-medium text-gray-900">{plate(f.vehicle_id)}</td>
                    <td className="px-6 py-4 text-gray-600">{fmtDate(f.fuel_date)}</td>
                    <td className="px-6 py-4 text-gray-600">{f.liters} L</td>
                    <td className="px-6 py-4 text-gray-600">₱{Number(f.cost).toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-500">{f.station || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard icon={Wrench} iconBg="bg-amber-100" iconColor="text-amber-700" value={records.filter((r) => r.maintenance_status === "pending").length} label="Pending Maintenance" />
            <StatCard icon={CarFront} iconBg="bg-green-100" iconColor="text-green-700" value={records.filter((r) => r.maintenance_status === "completed").length} label="Completed Maintenance" />
            <StatCard icon={Clock3} iconBg="bg-gray-100" iconColor="text-gray-600" value={`${avgDowntime} days`} label="Average Downtime" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <ChartCard title="Maintenance Cost Trend" subtitle="₱ per month">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={costByMonth}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Maintenance Frequency by Vehicle" subtitle="Services on record">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={freqByVehicle}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
                <tr>
                  <th className="px-6 py-3">Vehicle</th>
                  <th className="px-6 py-3">Maintenance Type</th>
                  <th className="px-6 py-3">Scheduled Date</th>
                  <th className="px-6 py-3">Status</th>
                  {canUpdate && <th className="px-6 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={canUpdate ? 6 : 5} className="text-center py-16 text-gray-400">No records.</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-6 py-4 font-medium text-gray-900">{plate(r.vehicle_id)}</td>
                    <td className="px-6 py-4 text-gray-600">{r.maintenance_type}</td>
                    <td className="px-6 py-4 text-gray-600">{fmtDate(r.scheduled_date)}</td>
                    <td className="px-6 py-4"><StatusBadge status={r.maintenance_status} /></td>
                    {canUpdate && (
                      <td className="px-6 py-4 text-right">
                        <select value={r.maintenance_status}
                          onChange={(e) => changeStatus(r.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule Maintenance">
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Vehicle</label>
            <select required value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.brand} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Maintenance Type</label>
            <input required value={form.maintenance_type} onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="Oil change & brake check" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Scheduled Date</label>
            <input required type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button type="submit" className="w-full mt-5 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            Schedule
          </button>
        </form>
      </Modal>

      <Modal open={fuelModalOpen} onClose={() => setFuelModalOpen(false)} title="Add Fuel Log">
        <form onSubmit={saveFuel} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Vehicle</label>
            <select required value={fuelForm.vehicle_id} onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.brand} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Driver (optional)</label>
            <select value={fuelForm.driver_id} onChange={(e) => setFuelForm({ ...fuelForm, driver_id: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
              <option value="">Unassigned</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Fuel Date</label>
            <input required type="date" autoComplete="off" value={fuelForm.fuel_date} onChange={(e) => setFuelForm({ ...fuelForm, fuel_date: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Liters</label>
            <input required type="number" step="0.01" inputMode="decimal" autoComplete="off" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Cost (₱)</label>
            <input required type="number" step="0.01" inputMode="decimal" autoComplete="off" value={fuelForm.cost} onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Odometer (optional)</label>
            <input type="number" step="0.01" inputMode="decimal" autoComplete="off" value={fuelForm.odometer} onChange={(e) => setFuelForm({ ...fuelForm, odometer: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Station (optional)</label>
            <input autoComplete="off" name="fuel-station" value={fuelForm.station} onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="Shell, Petron..." />
          </div>
          <button type="submit" className="w-full mt-5 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            Save fuel log
          </button>
        </form>
      </Modal>
    </div>
  );
}
