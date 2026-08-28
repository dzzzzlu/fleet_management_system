import { useEffect, useState } from "react";
import { TriangleAlert, SearchCheck, CircleCheck } from "lucide-react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import Tabs from "../components/Tabs";
import Modal from "../components/Modal";
import { fmtDate } from "../utils/format";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

export default function Incidents() {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [tab, setTab] = useState("reported");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_id: "", incident_type: "accident", incident_date: "", description: "" });
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();
  const canCreate = can(user?.role, "tripCreate");
  const canUpdate = can(user?.role, "tripUpdate");

  const load = () => api.get("/incidents").then((r) => setRecords(r.data)).catch((e) => handleError(e, "Failed to load incidents"));
  useEffect(() => {
    load();
    api.get("/vehicles").then((r) => setVehicles(r.data)).catch(() => {});
  }, []);

  const plate = (id) => vehicles.find((v) => v.id === id)?.plate_number || "—";

  const changeStatus = async (id, incident_status) => {
    try {
      await api.patch(`/incidents/${id}`, { incident_status });
      load();
    } catch (err) {
      handleError(err, "Failed to update incident status");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/incidents", form);
      setModalOpen(false);
      load();
    } catch (err) {
      handleError(err, "Failed to report incident");
    }
  };

  const filtered = records.filter((r) => r.incident_status === tab);

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
          <p className="text-gray-500 text-sm">{records.filter((r) => r.incident_status === "reported").length} reported</p>
        </div>
        {canCreate ? (
          <button onClick={() => setModalOpen(true)} className="bg-navy-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-700 transition-colors">
            + Report incident
          </button>
        ) : (
          <span className="text-xs text-gray-400 self-center">View only</span>
        )}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "reported", label: "Reported" },
          { value: "under_review", label: "Under Review" },
          { value: "resolved", label: "Resolved" },
          { value: "closed", label: "Closed" },
        ]}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={TriangleAlert} iconBg="bg-red-100" iconColor="text-red-700" value={records.filter((r) => r.incident_status === "reported").length} label="Reported Incidents" />
        <StatCard icon={SearchCheck} iconBg="bg-amber-100" iconColor="text-amber-700" value={records.filter((r) => r.incident_status === "under_review").length} label="Under Review" />
        <StatCard icon={CircleCheck} iconBg="bg-green-100" iconColor="text-green-700" value={records.filter((r) => r.incident_status === "resolved").length} label="Resolved" />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
            <tr>
              <th className="px-6 py-3">Vehicle</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Est. Cost</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-16 text-gray-400">No records.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-6 py-4 font-medium text-gray-900">{plate(r.vehicle_id)}</td>
                <td className="px-6 py-4 text-gray-600 capitalize">{r.incident_type}</td>
                <td className="px-6 py-4 text-gray-600">{fmtDate(r.incident_date)}</td>
                <td className="px-6 py-4 text-gray-600">{r.estimated_cost != null ? `₱${r.estimated_cost}` : "—"}</td>
                <td className="px-6 py-4">
                  {canUpdate ? (
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.incident_status} />
                      <select
                        value={r.incident_status}
                        onChange={(e) => changeStatus(r.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-navy-500"
                        title="Change status"
                      >
                        <option value="reported">Reported</option>
                        <option value="under_review">Under Review</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  ) : (
                    <StatusBadge status={r.incident_status} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Report Incident">
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
            <label className="text-xs text-gray-500">Type</label>
            <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
              <option value="accident">Accident</option>
              <option value="damage">Damage</option>
              <option value="violation">Violation</option>
              <option value="theft">Theft</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input required type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" rows={3} />
          </div>
          <button type="submit" className="w-full mt-5 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors">
            Report
          </button>
        </form>
      </Modal>
    </div>
  );
}
