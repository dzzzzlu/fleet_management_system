import { useEffect, useMemo, useState } from "react";
import { Truck, Car, Route, Wrench } from "lucide-react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import Tabs from "../components/Tabs";
import Modal from "../components/Modal";
import { toCSV, downloadCSV, fmtDate } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

const EMPTY = { plate_number: "", vehicle_type: "Sedan", brand: "", model: "", year: "", status: "available", insurance_provider: "", insurance_policy_number: "", insurance_expiry: "" };
const PAGE_SIZE = 10;

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tab, setTab] = useState("active");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();
  const canCreate = can(user?.role, "vehicleCreate");
  const canEdit = can(user?.role, "vehicleUpdate");
  const canDelete = can(user?.role, "vehicleDelete");

  const load = () => {
    api.get("/vehicles").then((r) => setVehicles(r.data)).catch((e) => handleError(e, "Failed to load vehicles"));
    api.get("/trips", { params: { trip_status: "active" } }).then((r) => setTrips(r.data)).catch(() => {});
    api.get("/maintenance").then((r) => setMaintenance(r.data)).catch(() => {});
    api.get("/drivers").then((r) => setDrivers(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const driverByVehicle = useMemo(() => {
    const m = new Map();
    trips.forEach((t) => {
      const d = drivers.find((dr) => dr.id === t.driver_id);
      if (d) m.set(t.vehicle_id, d.full_name);
    });
    return m;
  }, [trips, drivers]);

  const lastMaintenanceByVehicle = useMemo(() => {
    const m = new Map();
    maintenance.filter((r) => r.completed_date).forEach((r) => {
      const cur = m.get(r.vehicle_id);
      if (!cur || new Date(r.completed_date) > new Date(cur)) m.set(r.vehicle_id, r.completed_date);
    });
    return m;
  }, [maintenance]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (v) => { setEditing(v); setForm(v); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, year: form.year ? Number(form.year) : null };
      if (editing) await api.patch(`/vehicles/${editing.id}`, payload);
      else await api.post("/vehicles", payload);
      setModalOpen(false);
      load();
    } catch (err) {
      handleError(err, "Failed to save vehicle");
    }
  };

  const archive = async (id) => {
    try { await api.delete(`/vehicles/${id}`); load(); }
    catch (err) { handleError(err, "Failed to archive vehicle"); }
  };

  const tabFiltered = vehicles.filter((v) => {
    if (tab === "active") return v.status === "available" || v.status === "assigned";
    if (tab === "maintenance") return v.status === "maintenance";
    if (tab === "retired") return v.status === "retired" || v.status === "inactive";
    return true;
  });

  const filtered = tabFiltered.filter((v) =>
    `${v.plate_number} ${v.brand} ${v.model}`.toLowerCase().includes(search.toLowerCase()) &&
    (!statusFilter || v.status === statusFilter) &&
    (!typeFilter || v.vehicle_type === typeFilter)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const types = [...new Set(vehicles.map((v) => v.vehicle_type))];

  const exportCSV = () => {
    const csv = toCSV(filtered, [
      { label: "Plate Number", get: (v) => v.plate_number },
      { label: "Vehicle Type", get: (v) => v.vehicle_type },
      { label: "Brand", get: (v) => v.brand },
      { label: "Model", get: (v) => v.model },
      { label: "Driver", get: (v) => driverByVehicle.get(v.id) || "Unassigned" },
      { label: "Status", get: (v) => v.status },
      { label: "Last Maintenance", get: (v) => lastMaintenanceByVehicle.get(v.id) || "" },
    ]);
    downloadCSV("vehicles.csv", csv);
  };

  const counts = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === "available").length,
    assigned: vehicles.filter((v) => v.status === "assigned").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 text-sm">{counts.total} vehicles · {counts.maintenance} in maintenance</p>
        </div>
        {canCreate ? (
          <button onClick={openNew} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
            + New vehicle
          </button>
        ) : user?.role === "driver" ? null : (
          <span className="text-xs text-gray-400 self-center">View only</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      )}

      <Tabs
        active={tab}
        onChange={(v) => { setTab(v); setPage(1); }}
        tabs={[
          { value: "active", label: "Active Vehicles" },
          { value: "maintenance", label: "Maintenance" },
          { value: "retired", label: "Retired" },
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Truck} iconBg="bg-navy-100" iconColor="text-navy-700" value={counts.total} label="Total Vehicles" />
        <StatCard icon={Car} iconBg="bg-green-100" iconColor="text-green-700" value={counts.available} label="Available Vehicles" />
        <StatCard icon={Route} iconBg="bg-purple-100" iconColor="text-purple-700" value={counts.assigned} label="Assigned Vehicles" />
        <StatCard icon={Wrench} iconBg="bg-amber-100" iconColor="text-amber-700" value={counts.maintenance} label="Maintenance Vehicles" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search plate number, brand…"
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm"
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm">
          <option value="">Status</option>
          {["available", "assigned", "maintenance", "inactive", "retired"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm">
          <option value="">Vehicle type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={exportCSV} className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">
          Export
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
            <tr>
              <th className="px-6 py-3">Plate Number</th>
              <th className="px-6 py-3">Vehicle Type</th>
              <th className="px-6 py-3">Brand / Model</th>
              <th className="px-6 py-3">Driver</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Last Maintenance</th>
              {(canEdit || canDelete) && <th className="px-6 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-16 text-gray-400">No vehicles found.</td></tr>
            )}
            {pageRows.map((v) => (
              <tr key={v.id} className="border-t border-gray-100">
                <td className="px-6 py-4 font-medium text-gray-900">{v.plate_number}</td>
                <td className="px-6 py-4 text-gray-600">{v.vehicle_type}</td>
                <td className="px-6 py-4 text-gray-600">{v.brand} {v.model}</td>
                <td className="px-6 py-4 text-gray-500">{driverByVehicle.get(v.id) || "Unassigned"}</td>
                <td className="px-6 py-4"><StatusBadge status={v.status} /></td>
                <td className="px-6 py-4 text-gray-500">{lastMaintenanceByVehicle.get(v.id) ? fmtDate(lastMaintenanceByVehicle.get(v.id)) : "—"}</td>
                {(canEdit || canDelete) && (
                  <td className="px-6 py-4 text-right space-x-3">
                    {canEdit && <button onClick={() => openEdit(v)} className="text-navy-700 text-xs font-semibold hover:text-navy-900">Edit</button>}
                    {canDelete && <button onClick={() => archive(v.id)} className="text-red-600 text-xs font-medium">Archive</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 text-xs text-gray-500 border-t border-gray-100">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="space-x-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40">Prev</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Vehicle" : "New Vehicle"}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Plate Number" value={form.plate_number} onChange={(v) => setForm({ ...form, plate_number: v })} required />
          <div>
            <label className="text-xs text-gray-500">Vehicle Type</label>
            <input
              list="vehicle-types"
              value={form.vehicle_type}
              onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              placeholder="e.g. Sedan, Van, Truck..."
            />
            <datalist id="vehicle-types">
              {types.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <Field label="Brand" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} required />
          <Field label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} required />
          <Field label="Year" value={form.year} onChange={(v) => setForm({ ...form, year: v })} type="number" />
          <Field label="Insurance Provider" value={form.insurance_provider} onChange={(v) => setForm({ ...form, insurance_provider: v })} />
          <Field label="Policy Number" value={form.insurance_policy_number} onChange={(v) => setForm({ ...form, insurance_policy_number: v })} />
          <Field label="Insurance Expiry" value={form.insurance_expiry} onChange={(v) => setForm({ ...form, insurance_expiry: v })} type="date" />
          {editing && (
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              >
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          )}
          <button type="submit" className="w-full mt-5 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            {editing ? "Save changes" : "Add vehicle"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
function Field({ label, value, onChange, type = "text", required }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        name={`field-${label.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`}
        className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
      />
    </div>
  );
}