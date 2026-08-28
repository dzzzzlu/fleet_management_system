import { useEffect, useMemo, useState } from "react";
import { Bell, SlidersHorizontal, Cog, UserPlus, Users } from "lucide-react";
import api from "../api/client";
import Tabs from "../components/Tabs";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage } from "../utils/errors";
import { useErrorHandler } from "../hooks/useErrorHandler";

const ROLES = ["viewer", "staff", "manager", "driver", "administrator"];
const EMPTY_USER = { full_name: "", email: "", password: "", role: "staff", phone: "" };

const VEHICLE_STATUSES = [
  { value: "available", label: "Available", color: "#16a34a" },
  { value: "assigned", label: "Assigned", color: "#2563eb" },
  { value: "maintenance", label: "Maintenance", color: "#d97706" },
  { value: "inactive", label: "Inactive", color: "#6b7280" },
  { value: "retired", label: "Retired", color: "#374151" },
];

const DRIVER_STATUSES = [
  { value: "active", label: "Active", color: "#16a34a" },
  { value: "inactive", label: "Inactive", color: "#6b7280" },
  { value: "suspended", label: "Suspended", color: "#dc2626" },
];

const NOTIFICATION_EVENTS = [
  { key: "trip_completed", label: "Trip completed" },
  { key: "maintenance_scheduled", label: "Maintenance scheduled" },
  { key: "maintenance_due", label: "Maintenance nearing due" },
  { key: "incident_created", label: "Incident reported" },
];

const DELIVERY_CHANNELS = [
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "push", label: "Push" },
];

const DEFAULT_NOTIFICATIONS = {
  enabled: true,
  events: { trip_completed: true, maintenance_scheduled: true, maintenance_due: true, incident_created: true },
  channels: { email: true, sms: false, push: false },
};

const DEFAULT_SYSTEM = {
  org_name: "",
  currency: "PHP",
  date_format: "MM/DD/YYYY",
  maintenance_due_days: 7,
};

// ---------------------------------------------------------------------------
// Small shared UI bits (kept inline to match the codebase's inline styling).
// ---------------------------------------------------------------------------
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 ${checked ? "bg-navy-600" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SettingRow({ title, description, children }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------
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

  // Organization-scoped preference storage (localStorage demo persistence)
  const storageKey = useMemo(() => (user?.organization_id ? `settings:${user.organization_id}` : null), [user?.organization_id]);

  const [statusCfg, setStatusCfg] = useState(() => ({
    vehicles: VEHICLE_STATUSES.map((s) => ({ ...s, enabled: true })),
    drivers: DRIVER_STATUSES.map((s) => ({ ...s, enabled: true })),
  }));
  const [notif, setNotif] = useState(DEFAULT_NOTIFICATIONS);
  const [system, setSystem] = useState(DEFAULT_SYSTEM);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.get("/vehicles").then((r) => setVehicles(r.data)).catch((e) => handleError(e, "Failed to load settings")); }, []);

  useEffect(() => {
    if (isAdmin && tab === "users") {
      api.get("/auth/users").then((r) => setOrgUsers(r.data)).catch((e) => handleError(e, "Failed to load users"));
    }
  }, [isAdmin, tab]);

  // Load org-scoped prefs from localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.statusCfg) setStatusCfg(data.statusCfg);
      if (data.notif) setNotif({ ...DEFAULT_NOTIFICATIONS, ...data.notif });
      if (data.system) setSystem({ ...DEFAULT_SYSTEM, ...data.system });
    } catch { /* ignore malformed storage */ }
  }, [storageKey]);

  useEffect(() => {
    if (user && !system.org_name) setSystem((s) => ({ ...s, org_name: user?.full_name ? `${user.full_name}'s Org` : "My Fleet" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function persist(next, which) {
    if (!storageKey) return;
    const merged = JSON.parse(localStorage.getItem(storageKey) || "{}");
    merged[which] = next;
    localStorage.setItem(storageKey, JSON.stringify(merged));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

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

  function toggleStatus(group, value) {
    const key = group === "vehicles" ? "vehicles" : "drivers";
    const next = {
      ...statusCfg,
      [key]: statusCfg[key].map((s) => (s.value === value ? { ...s, enabled: !s.enabled } : s)),
    };
    setStatusCfg(next);
    persist(next, "statusCfg");
  }

  function setStatusColor(group, value, color) {
    const key = group === "vehicles" ? "vehicles" : "drivers";
    const next = {
      ...statusCfg,
      [key]: statusCfg[key].map((s) => (s.value === value ? { ...s, color } : s)),
    };
    setStatusCfg(next);
    persist(next, "statusCfg");
  }

  function StatusList({ title, group, list }) {
    return (
      <div>
        <div className="font-semibold text-gray-900 mb-2">{title}</div>
        <div className="divide-y divide-gray-100">
          {list.map((s) => (
            <SettingRow key={s.value} title={s.label} description={`${s.value}`}>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input
                    type="color"
                    value={s.color}
                    onChange={(e) => setStatusColor(group, s.value, e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-gray-200 bg-transparent p-0.5"
                    title="Set status color"
                  />
                </label>
                <Toggle checked={s.enabled} onChange={() => toggleStatus(group, s.value)} label={`Enable ${s.label}`} />
              </div>
            </SettingRow>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Toggling a status off hides it from filter options across the module. Colors are used in dashboard charts and badges.
        </p>
      </div>
    );
  }

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

      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Preferences saved.
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

      {tab === "status" && (
        <div className="bg-white rounded-xl p-6 shadow-sm max-w-2xl">
          <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
            <SlidersHorizontal size={18} strokeWidth={2} className="text-navy-700" aria-hidden />
            Status Configuration
          </div>
          <p className="text-xs text-gray-400 mb-4">Enable/disable statuses and set their display colors.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <StatusList title="Vehicle Statuses" group="vehicles" list={statusCfg.vehicles} />
            <StatusList title="Driver Statuses" group="drivers" list={statusCfg.drivers} />
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div className="bg-white rounded-xl p-6 shadow-sm max-w-2xl">
          <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
            <Bell size={18} strokeWidth={2} className="text-navy-700" aria-hidden />
            Notification Settings
          </div>
          <p className="text-xs text-gray-400 mb-2">Choose which events generate alerts and how they are delivered.</p>

          <div className="mt-2">
            <SettingRow title="Enable notifications" description="Master switch for all alerts.">
              <Toggle checked={notif.enabled} onChange={(v) => { const n = { ...notif, enabled: v }; setNotif(n); persist(n, "notif"); }} label="Enable notifications" />
            </SettingRow>
          </div>

          <div className="font-medium text-gray-900 text-sm mt-4 mb-1">Event alerts</div>
          {NOTIFICATION_EVENTS.map((ev) => (
            <SettingRow key={ev.key} title={ev.label}>
              <Toggle checked={notif.enabled && !!notif.events[ev.key]}
                onChange={(v) => { const n = { ...notif, events: { ...notif.events, [ev.key]: v } }; setNotif(n); persist(n, "notif"); }}
                label={`Alert on ${ev.label}`} />
            </SettingRow>
          ))}

          <div className="font-medium text-gray-900 text-sm mt-4 mb-1">Delivery channels</div>
          {DELIVERY_CHANNELS.map((ch) => (
            <SettingRow key={ch.key} title={ch.label}>
              <Toggle checked={notif.enabled && !!notif.channels[ch.key]}
                onChange={(v) => { const n = { ...notif, channels: { ...notif.channels, [ch.key]: v } }; setNotif(n); persist(n, "notif"); }}
                label={`Deliver via ${ch.label}`} />
            </SettingRow>
          ))}
        </div>
      )}

      {tab === "system" && (
        <div className="bg-white rounded-xl p-6 shadow-sm max-w-2xl">
          <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
            <Cog size={18} strokeWidth={2} className="text-navy-700" aria-hidden />
            System Preferences
          </div>
          <p className="text-xs text-gray-400 mb-2">Organization-wide defaults for the module.</p>

          <div className="mt-2">
            <SettingRow title="Organization name" description="Shown on reports and the dashboard header.">
              <input value={system.org_name} onChange={(e) => setSystem((s) => ({ ...s, org_name: e.target.value }))}
                onBlur={() => persist(system, "system")}
                className="w-52 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </SettingRow>
            <SettingRow title="Default currency" description="Used on fuel and cost fields.">
              <select value={system.currency} onChange={(e) => { const s = { ...system, currency: e.target.value }; setSystem(s); persist(s, "system"); }}
                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="PHP">PHP (₱)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </SettingRow>
            <SettingRow title="Date format" description="How dates are displayed throughout the module.">
              <select value={system.date_format} onChange={(e) => { const s = { ...system, date_format: e.target.value }; setSystem(s); persist(s, "system"); }}
                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </SettingRow>
            <SettingRow title="Maintenance due window" description="Days ahead to flag maintenance as overdue/nearing due.">
              <input type="number" min={1} max={90} value={system.maintenance_due_days}
                onChange={(e) => setSystem((s) => ({ ...s, maintenance_due_days: Number(e.target.value) }))}
                onBlur={() => persist(system, "system")}
                className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </SettingRow>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
            <button onClick={() => persist(system, "system")}
              className="bg-navy-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-navy-700 transition-colors">
              Save preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
