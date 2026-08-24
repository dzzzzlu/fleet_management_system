import { useEffect, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import api from "../api/client";
import Tabs from "../components/Tabs";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage } from "../utils/errors";
import { useErrorHandler } from "../hooks/useErrorHandler";

const ROLES = ["viewer", "staff", "manager", "driver", "administrator"];
const EMPTY_USER = { full_name: "", email: "", password: "", role: "staff", phone: "" };

export default function Settings() {
  const [vehicles, setVehicles] = useState([]);
  const [tab, setTab] = useState("types");
  const { error, debug, handleError } = useErrorHandler();
  const { user } = useAuth();
  const isAdmin = user?.role === "administrator";

  // Add-user form state (admin only)
  const [newUser, setNewUser] = useState(EMPTY_USER);
  const [orgUsers, setOrgUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "success"|"error", text }

  useEffect(() => { api.get("/vehicles").then((r) => setVehicles(r.data)).catch((e) => handleError(e, "Failed to load settings")); }, []);

  useEffect(() => {
    if (isAdmin && tab === "users") {
      api.get("/auth/users").then((r) => setOrgUsers(r.data)).catch((e) => handleError(e, "Failed to load users"));
    }
  }, [isAdmin, tab]);

  async function addUser(e) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/auth/users", {
        full_name: newUser.full_name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        phone: newUser.phone || undefined,
      });
      setNotice({ type: "success", text: `Account created for ${newUser.email}` });
      setNewUser(EMPTY_USER);
      const r = await api.get("/auth/users");
      setOrgUsers(r.data);
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err, "Could not create user") });
    } finally {
      setSaving(false);
    }
  }

  const typeCounts = vehicles.reduce((acc, v) => {
    if (v.status !== "retired" && v.status !== "inactive") acc[v.vehicle_type] = (acc[v.vehicle_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="text-gray-500 text-sm mb-6">Configure module-wide defaults</p>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "types", label: "Vehicle Types" },
          ...(isAdmin ? [{ value: "users", label: "User Management" }] : []),
          { value: "status", label: "Status Configuration" },
          { value: "notifications", label: "Notification Settings" },
          { value: "system", label: "System Preferences" },
        ]}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          {debug && <div className="text-xs text-red-400 mt-1">{debug}</div>}
        </div>
      )}

      {tab === "types" && (
        <div className="bg-white rounded-xl p-6 shadow-sm max-w-xl">
          <div className="font-semibold text-gray-900 mb-4">Vehicle Types</div>
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs uppercase text-left">
              <tr><th className="py-2">Type</th><th className="py-2">Active Vehicles</th></tr>
            </thead>
            <tbody>
              {Object.entries(typeCounts).map(([type, count]) => (
                <tr key={type} className="border-t border-gray-100">
                  <td className="py-3">{type}</td>
                  <td className="py-3">{count}</td>
                </tr>
              ))}
              {Object.keys(typeCounts).length === 0 && (
                <tr><td colSpan={2} className="py-6 text-center text-gray-400">No vehicle types yet.</td></tr>
              )}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-4">Types are derived automatically from registered vehicles.</p>
        </div>
      )}

      {tab === "users" && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start max-w-5xl">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
              <UserPlus size={18} strokeWidth={2} className="text-navy-700" aria-hidden />
              Add User
            </div>
            <p className="text-xs text-gray-400 mb-4">Creates an account under your organization with the chosen role.</p>

            {notice && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${notice.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {notice.text}
              </div>
            )}

            <form onSubmit={addUser} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Full Name</label>
                <input required value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" autoComplete="off" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" autoComplete="off" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Role</label>
                <select required value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm capitalize bg-white">
                  {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Password (min 8 characters)</label>
                <input required type="password" minLength={8} value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" autoComplete="new-password" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Phone (optional)</label>
                <input type="tel" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" placeholder="+63 9xx xxx xxxx" autoComplete="off" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full mt-2 bg-navy-600 text-white font-medium py-3 rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50">
                {saving ? "Creating…" : "Create account"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
              <Users size={18} strokeWidth={2} className="text-navy-700" aria-hidden />
              Organization Accounts ({orgUsers.length})
            </div>
            <ul className="divide-y divide-gray-100">
              {orgUsers.map((u) => (
                <li key={u.id} className="py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize shrink-0 ${u.role === "administrator" ? "bg-navy-100 text-navy-800" : u.role === "driver" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.role}
                  </span>
                </li>
              ))}
              {orgUsers.length === 0 && <li className="py-6 text-center text-sm text-gray-400">No accounts found.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab !== "types" && tab !== "users" && (
        <div className="bg-white rounded-xl p-6 shadow-sm text-gray-400 text-sm">
          Coming soon.
        </div>
      )}
    </div>
  );
}
