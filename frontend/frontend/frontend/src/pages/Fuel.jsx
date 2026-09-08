import { useEffect, useMemo, useState } from "react";
import { Fuel as FuelIcon, GaugeCircle, Wallet, Droplets } from "lucide-react";
import api from "../api/client";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import Tabs from "../components/Tabs";
import { fmtDate } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

const EMPTY = { vehicle_id: "", fuel_date: "", liters: "", price_per_liter: "", odometer: "", station: "" };

export default function Fuel() {
  const [logs, setLogs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();
  const canCreate = can(user?.role, "maintenanceCreate");

  const load = () => {
    api.get("/fuel-logs").then((r) => setLogs(r.data)).catch((e) => handleError(e, "Failed to load fuel logs"));
    api.get("/vehicles").then((r) => setVehicles(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const liters = Number(form.liters) || 0;
  const price = Number(form.price_per_liter) || 0;
  const autoCost = (liters * price).toFixed(2);

  const vehiclePlate = (id) => vehicles.find((v) => v.id === id)?.plate_number || "—";

  const stats = useMemo(() => {
    const totalCost = logs.reduce((s, f) => s + Number(f.cost || 0), 0);
    const totalLiters = logs.reduce((s, f) => s + Number(f.liters || 0), 0);
    return {
      totalCost: totalCost.toLocaleString(),
      totalLiters: totalLiters.toLocaleString(),
      avgPrice: totalLiters ? (totalCost / totalLiters).toFixed(2) : "0.00",
    };
  }, [logs]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fuel-logs", {
        vehicle_id: form.vehicle_id,
        fuel_date: form.fuel_date,
        liters: Number(form.liters),
        price_per_liter: Number(form.price_per_liter) || undefined,
        odometer: form.odometer ? Number(form.odometer) : undefined,
        station: form.station || undefined,
      });
      setModalOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      handleError(err, "Failed to log fuel");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Logs</h1>
          <p className="text-gray-500 text-sm">Cost is auto-computed from liters × price per liter</p>
        </div>
        {canCreate ? (
          <button onClick={() => setModalOpen(true)} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
            + Log fuel
          </button>
        ) : (
          <span className="text-xs text-gray-400 self-center">View only</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Wallet} iconBg="bg-navy-100" iconColor="text-navy-700" value={`₱${stats.totalCost}`} label="Total Fuel Cost" />
        <StatCard icon={Droplets} iconBg="bg-purple-100" iconColor="text-purple-700" value={`${stats.totalLiters} L`} label="Total Liters" />
        <StatCard icon={GaugeCircle} iconBg="bg-brand-100" iconColor="text-brand-700" value={`₱${stats.avgPrice}`} label="Avg Price / Liter" />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
            <tr>
              <th className="px-6 py-3">Vehicle</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Liters</th>
              <th className="px-6 py-3">Price / L</th>
              <th className="px-6 py-3">Total Cost</th>
              <th className="px-6 py-3">Odometer</th>
              <th className="px-6 py-3">Station</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={7} className="text-center py-16 text-gray-400">No fuel logs yet.</td></tr>}
            {logs.map((f) => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="px-6 py-4 font-medium text-gray-900">{f.vehicle_plate || vehiclePlate(f.vehicle_id)}</td>
                <td className="px-6 py-4 text-gray-600">{fmtDate(f.fuel_date)}</td>
                <td className="px-6 py-4 text-gray-600">{Number(f.liters).toLocaleString()} L</td>
                <td className="px-6 py-4 text-gray-600">₱{f.price_per_liter != null ? Number(f.price_per_liter).toFixed(2) : "—"}</td>
                <td className="px-6 py-4 font-medium text-gray-900">₱{Number(f.cost).toLocaleString()}</td>
                <td className="px-6 py-4 text-gray-500">{f.odometer != null ? `${Number(f.odometer).toLocaleString()} km` : "—"}</td>
                <td className="px-6 py-4 text-gray-500">{f.station || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Fuel">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Vehicle</label>
            <select required value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.brand} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Fuel Date</label>
            <input required type="date" value={form.fuel_date} onChange={(e) => setForm({ ...form, fuel_date: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Liters</label>
              <input required type="number" min="0" step="0.01" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Price per Liter (₱)</label>
              <input type="number" min="0" step="0.01" value={form.price_per_liter} onChange={(e) => setForm({ ...form, price_per_liter: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="0.00" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-navy-50 rounded-lg text-sm">
            <span className="text-gray-600">Auto-computed total</span>
            <span className="font-semibold text-navy-800">₱{autoCost}</span>
          </div>
          <div>
            <label className="text-xs text-gray-500">Odometer (km)</label>
            <input type="number" min="0" step="0.1" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="e.g. 45210" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Station (optional)</label>
            <input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="e.g. Shell SLEX" />
          </div>
          <button type="submit" className="w-full mt-2 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            Log fuel
          </button>
        </form>
      </Modal>
    </div>
  );
}