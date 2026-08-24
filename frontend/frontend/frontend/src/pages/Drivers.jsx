import { useEffect, useMemo, useState } from "react";
import { Users, UserRoundCheck, CarFront } from "lucide-react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import Tabs from "../components/Tabs";
import Modal from "../components/Modal";
import { toCSV, downloadCSV } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";

const EMPTY = { employee_number: "", full_name: "", license_number: "", phone: "" };
const PAGE_SIZE = 10;

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState("active");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { error, debug, handleError } = useErrorHandler();

  const load = () => {
    api.get("/drivers").then((r) => setDrivers(r.data)).catch((e) => handleError(e, "Failed to load drivers"));
    api.get("/trips", { params: { trip_status: "active" } }).then((r) => setTrips(r.data)).catch(() => {});
    api.get("/vehicles").then((r) => setVehicles(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const vehicleByDriver = useMemo(() => {
    const m = new Map();
    trips.forEach((t) => {
      const v = vehicles.find((vh) => vh.id === t.vehicle_id);
      if (v) m.set(t.driver_id, v.plate_number);
    });
    return m;
  }, [trips, vehicles]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/drivers", form);
      setModalOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      handleError(err, "Failed to add driver");
    }
  };

  const tabFiltered = drivers.filter((d) => {
    if (tab === "active") return d.status === "active";
    if (tab === "archived") return d.status === "inactive" || d.status === "suspended";
    return true;
  });
  const filtered = tabFiltered.filter((d) =>
    `${d.employee_number} ${d.full_name}`.toLowerCase().includes(search.toLowerCase()) &&
    (!statusFilter || d.status === statusFilter)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    active: drivers.filter((d) => d.status === "active").length,
    assigned: vehicleByDriver.size,
  };

  const exportCSV = () => {
    const csv = toCSV(filtered, [
      { label: "Employee Number", get: (d) => d.employee_number },
      { label: "Driver Name", get: (d) => d.full_name },
      { label: "License Number", get: (d) => d.license_number },
      { label: "Assigned Vehicle", get: (d) => vehicleByDriver.get(d.id) || "Unassigned" },
      { label: "Status", get: (d) => d.status },
    ]);
    downloadCSV("drivers.csv", csv);
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-500 text-sm">{counts.active} active drivers</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
          + Add driver
        </button>
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
          { value: "active", label: "Active Drivers" },
          { value: "assignments", label: "Assignments" },
          { value: "archived", label: "Archived" },
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Users} iconBg="bg-purple-100" iconColor="text-purple-700" value={counts.active} label="Active Drivers" />
        <StatCard icon={UserRoundCheck} iconBg="bg-green-100" iconColor="text-green-700" value={Math.max(counts.active - counts.assigned, 0)} label="Available Drivers" />
        <StatCard icon={CarFront} iconBg="bg-navy-100" iconColor="text-navy-700" value={counts.assigned} label="Assigned Drivers" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search employee no., name…"
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm"
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm">
          <option value="">Status</option>
          {["active", "inactive", "suspended"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exportCSV} className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">
          Export
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
            <tr>
              <th className="px-6 py-3">Employee Number</th>
              <th className="px-6 py-3">Driver Name</th>
              <th className="px-6 py-3">License Number</th>
              <th className="px-6 py-3">Assigned Vehicle</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={5} className="text-center py-16 text-gray-400">No drivers found.</td></tr>
            )}
            {pageRows.map((d) => (
              <tr key={d.id} className="border-t border-gray-100">
                <td className="px-6 py-4 text-gray-600">{d.employee_number}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{d.full_name}</td>
                <td className="px-6 py-4 text-gray-500">{d.license_number}</td>
                <td className="px-6 py-4 text-gray-500">{vehicleByDriver.get(d.id) || "Unassigned"}</td>
                <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Driver">
        <form onSubmit={save} className="space-y-3">
          {["employee_number", "full_name", "license_number", "phone"].map((key) => (
            <div key={key}>
              <label className="text-xs text-gray-500 capitalize">{key.replace("_", " ")}</label>
              <input
                required={key !== "phone"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          ))}
          <button type="submit" className="w-full mt-5 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            Add driver
          </button>
        </form>
      </Modal>
    </div>
  );
}
