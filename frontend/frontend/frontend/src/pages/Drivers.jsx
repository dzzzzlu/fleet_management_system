import { useEffect, useMemo, useState } from "react";
import { Users, UserRoundCheck, CarFront, ArrowRightLeft } from "lucide-react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import Tabs from "../components/Tabs";
import Modal from "../components/Modal";
import { toCSV, downloadCSV, fmtDate } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

const EMPTY = { employee_number: "", full_name: "", license_number: "", phone: "", license_expiry: "" };
const PAGE_SIZE = 10;

const ASSIGN_STATUS_STYLE = {
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  returned: "bg-gray-200 text-gray-600",
  cancelled: "bg-gray-200 text-gray-600",
};

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState("active");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDriver, setAssignDriver] = useState(null);
  const [assignForm, setAssignForm] = useState({ driver_id: "", vehicle_id: "", assigned_date: "", notes: "" });
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();
  const role = user?.role;
  const canCreate = can(role, "driverCreate");
  const canEdit = can(role, "driverUpdate");
  const canDelete = can(role, "driverDelete");
  const canAssign = role === "administrator" || role === "manager";

  const load = () => {
    api.get("/drivers").then((r) => setDrivers(r.data)).catch((e) => handleError(e, "Failed to load drivers"));
    api.get("/assignments").then((r) => setAssignments(r.data)).catch(() => {});
    api.get("/vehicles").then((r) => setVehicles(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.display_status === "active"),
    [assignments]
  );
  const vehicleByDriver = useMemo(() => {
    const m = new Map();
    activeAssignments.forEach((a) => m.set(a.driver_id, `${a.vehicle_plate} (${a.vehicle_brand} ${a.vehicle_model})`));
    return m;
  }, [activeAssignments]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ ...d }); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, license_expiry: form.license_expiry || null, phone: form.phone || null };
      if (editing) await api.patch(`/drivers/${editing.id}`, payload);
      else await api.post("/drivers", payload);
      setModalOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      handleError(err, editing ? "Failed to update driver" : "Failed to add driver");
    }
  };

  const changeStatus = async (id, status) => {
    try { await api.patch(`/drivers/${id}`, { status }); load(); }
    catch (err) { handleError(err, "Failed to update driver status"); }
  };

  const archive = async (id) => {
    if (!window.confirm("Archive this driver? This hides them from the fleet roster.")) return;
    try { await api.delete(`/drivers/${id}`); load(); }
    catch (err) { handleError(err, "Failed to archive driver"); }
  };

  const openAssign = (d) => {
    setAssignDriver(d);
    setAssignForm({ driver_id: d.id, vehicle_id: "", assigned_date: "", notes: "" });
    setAssignOpen(true);
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    try {
      await api.post("/assignments", { ...assignForm, notes: assignForm.notes || null });
      setAssignOpen(false);
      load();
    } catch (err) {
      handleError(err, "Failed to assign vehicle");
    }
  };

  const returnAssignment = async (id) => {
    if (!window.confirm("Return this vehicle from the driver? This closes the active assignment.")) return;
    try { await api.post(`/assignments/${id}/return`); load(); }
    catch (err) { handleError(err, "Failed to return vehicle"); }
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
    assigned: activeAssignments.length,
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

  const assignableVehicles = vehicles.filter((v) => v.status !== "inactive" && v.status !== "retired");

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-500 text-sm">{counts.active} active drivers</p>
        </div>
        {canCreate ? (
          <button onClick={() => setModalOpen(true)} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
            + Add driver
          </button>
        ) : role === "driver" ? null : (
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
          { value: "active", label: "Active Drivers" },
          { value: "assignments", label: "Assignments" },
          { value: "archived", label: "Archived" },
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Users} iconBg="bg-purple-100" iconColor="text-purple-700" value={counts.active} label="Active Drivers" />
        <StatCard icon={CarFront} iconBg="bg-navy-100" iconColor="text-navy-700" value={counts.assigned} label="Assigned Drivers" />
        <StatCard icon={UserRoundCheck} iconBg="bg-green-100" iconColor="text-green-700" value={Math.max(counts.active - counts.assigned, 0)} label="Available Drivers" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search employee no., name…"
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm"
        />
        {tab !== "assignments" && (
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm">
            <option value="">Status</option>
            {["active", "inactive", "suspended"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {tab !== "assignments" && (
          <button onClick={exportCSV} className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50">
            Export
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        {tab === "assignments" ? (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
              <tr>
                <th className="px-6 py-3">Driver</th>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Assigned Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Returned</th>
                {canAssign && <th className="px-6 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={canAssign ? 6 : 5} className="text-center py-16 text-gray-400">
                    No vehicle assignments yet. Use Assign on a driver to schedule a vehicle.
                  </td>
                </tr>
              )}
              {assignments.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{a.driver_name}</div>
                    <div className="text-xs text-gray-400">{a.driver_employee_number}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    <span className="font-medium text-gray-900">{a.vehicle_plate}</span>{" "}
                    <span className="text-gray-400">({a.vehicle_brand} {a.vehicle_model})</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{fmtDate(a.assigned_date)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${ASSIGN_STATUS_STYLE[a.display_status] || "bg-gray-100 text-gray-600"}`}>
                      {a.display_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{a.returned_date ? fmtDate(a.returned_date) : "—"}</td>
                  {canAssign && (
                    <td className="px-6 py-4 text-right">
                      {(a.display_status === "active" || a.display_status === "scheduled") && (
                        <button onClick={() => returnAssignment(a.id)} className="text-red-600 text-xs font-medium hover:text-red-800">
                          Return
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
                <tr>
                  <th className="px-6 py-3">Employee Number</th>
                  <th className="px-6 py-3">Driver Name</th>
                  <th className="px-6 py-3">License Number</th>
                  <th className="px-6 py-3">Assigned Vehicle</th>
                  <th className="px-6 py-3">Status</th>
                  {(canEdit || canDelete || canAssign) && <th className="px-6 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr><td colSpan={canEdit || canDelete || canAssign ? 6 : 5} className="text-center py-16 text-gray-400">No drivers found.</td></tr>
                )}
                {pageRows.map((d) => (
                  <tr key={d.id} className="border-t border-gray-100">
                    <td className="px-6 py-4 text-gray-600">{d.employee_number}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{d.full_name}</td>
                    <td className="px-6 py-4 text-gray-500">{d.license_number}</td>
                    <td className="px-6 py-4 text-gray-500">{vehicleByDriver.get(d.id) || "Unassigned"}</td>
                    <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                    {(canEdit || canDelete || canAssign) && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {canAssign && d.status === "active" && !vehicleByDriver.get(d.id) && (
                          <button onClick={() => openAssign(d)} className="text-blue-700 text-xs font-semibold hover:text-blue-900 mr-3">
                            Assign
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <select value={d.status} onChange={(e) => changeStatus(d.id, e.target.value)}
                              className="mr-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                              <option value="active">Active</option>
                              <option value="on_leave">On Leave</option>
                              <option value="inactive">Inactive</option>
                              <option value="suspended">Suspended</option>
                            </select>
                            <button onClick={() => openEdit(d)} className="text-navy-700 text-xs font-semibold hover:text-navy-900 mr-3">Edit</button>
                          </>
                        )}
                        {canDelete && (
                          <button onClick={() => archive(d.id)} className="text-red-600 text-xs font-medium hover:text-red-800">Archive</button>
                        )}
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
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Driver" : "Add Driver"}>
        <form onSubmit={save} className="space-y-3">
          {["employee_number", "full_name", "license_number", "phone", "license_expiry"].map((key) => (
            <div key={key}>
              <label className="text-xs text-gray-500 capitalize">{key.replace("_", " ")}</label>
              <input
                required={key !== "phone" && key !== "license_expiry"}
                type={key === "license_expiry" ? "date" : "text"}
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          ))}
          {editing && (
            <div>
              <label className="text-xs text-gray-500 capitalize">Status</label>
              <select value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}
          <button type="submit" className="w-full mt-5 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            {editing ? "Save changes" : "Add driver"}
          </button>
        </form>
      </Modal>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={`Assign Vehicle · ${assignDriver?.full_name || ""}`}>
        <form onSubmit={submitAssign} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 capitalize">Vehicle</label>
            <select required value={assignForm.vehicle_id} onChange={(e) => setAssignForm({ ...assignForm, vehicle_id: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Select vehicle…</option>
              {assignableVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plate_number} — {v.brand} {v.model}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 capitalize">Effective Date</label>
            <input
              required
              type="date"
              value={assignForm.assigned_date}
              min={(() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toISOString().split("T")[0]; })()}
              onChange={(e) => setAssignForm({ ...assignForm, assigned_date: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Vehicles can only be assigned on a future date (not today). This will show as scheduled until its date.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 capitalize">Notes (optional)</label>
            <input
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button type="submit" className="w-full mt-5 flex items-center justify-center gap-2 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            <ArrowRightLeft size={16} aria-hidden /> Assign vehicle
          </button>
        </form>
      </Modal>
    </div>
  );
}
