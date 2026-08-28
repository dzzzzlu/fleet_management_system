import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Truck,
  Users,
  Phone,
  Wrench,
  TriangleAlert,
  ClipboardList,
  Settings as SettingsIcon,
  Archive as ArchiveIcon,
  Bell,
  LogOut,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { canAccess } from "../auth/permissions";

const ICON_PROPS = { size: 18, strokeWidth: 2, "aria-hidden": true };

const NAV = [
  { section: "FLEET MANAGEMENT", items: [
    { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
    { to: "/vehicles", label: "Vehicles", Icon: Truck, badgeKey: "total_vehicles" },
    { to: "/drivers", label: "Drivers", Icon: Users, badgeKey: "active_drivers" },
    { to: "/trips", label: "Trips", Icon: Phone },
    { to: "/maintenance", label: "Maintenance", Icon: Wrench, badgeKey: "pending_maintenance" },
    { to: "/incidents", label: "Incidents", Icon: TriangleAlert },
  ]},
  { section: "INSIGHTS", items: [
    { to: "/reports", label: "Reports", Icon: ClipboardList },
  ]},
  { section: "MANAGEMENT", items: [
    { to: "/archives", label: "Archives", Icon: ArchiveIcon },
  ]},
  { section: "ADMIN", items: [
    { to: "/settings", label: "Settings", Icon: SettingsIcon },
  ]},
];

const MOBILE_NAV = [
  { to: "/", label: "Home", Icon: LayoutDashboard, end: true },
  { to: "/trips", label: "Trips", Icon: Phone },
  { to: "/maintenance", label: "Maint.", Icon: Wrench },
  { to: "/incidents", label: "Incidents", Icon: TriangleAlert },
  { to: "/vehicles", label: "Vehicles", Icon: Truck },
];

const CRUMBS = {
  "/": "Dashboard", "/vehicles": "Vehicles", "/drivers": "Drivers",
  "/trips": "Trips", "/maintenance": "Maintenance", "/incidents": "Incidents", "/reports": "Reports", "/settings": "Settings", "/archives": "Archives",
};

function LogoMark({ size = "md" }) {
  const box = size === "lg" ? "w-10 h-10 rounded-xl" : "w-9 h-9 rounded-lg";
  return (
    <div className={`${box} bg-navy-500 flex items-center justify-center shrink-0`}>
      <Truck size={size === "lg" ? 22 : 20} strokeWidth={2.2} className="text-white" aria-hidden />
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState({});
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const unread = notifs.filter((n) => !n.is_read).length;

  const loadNotifications = () => {
    api.get("/notifications").then((r) => setNotifs(r.data.notifications || [])).catch(() => {});
  };

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setSummary(r.data)).catch(() => {});
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markOne(key) {
    try {
      await api.post("/notifications/read", { keys: [key] });
      setNotifs((prev) => prev.map((n) => (n.key === key ? { ...n, is_read: true } : n)));
    } catch { /* non-fatal */ }
  }

  async function markAll() {
    try {
      await api.post("/notifications/read-all");
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* non-fatal */ }
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso);
    const diff = Date.now() - then.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const CATEGORY_DOT = {
    maintenance: "bg-amber-500",
    incident: "bg-red-500",
    trip: "bg-blue-500",
    compliance: "bg-purple-500",
    vehicle: "bg-green-500",
  };

  const visibleNav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccess(user?.role, item.to)),
  })).filter((group) => group.items.length > 0);

  const initials = (user?.full_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-64 bg-navy text-white flex-col">
        <div className="p-4 flex items-center gap-2.5 border-b border-white/10">
          <LogoMark />
          <span className="font-semibold text-sm">DazAutoTrack</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {visibleNav.map((group) => (
            <div key={group.section}>
              <div className="text-[11px] tracking-wide text-white/40 px-3 mb-2">{group.section}</div>
              {group.items.map(({ to, label, Icon, end, badgeKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `relative flex items-center justify-between px-3 py-2.5 mb-1 rounded-lg text-sm transition-colors duration-150 ${
                      isActive ? "bg-navy-800 text-white font-medium" : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-navy-400" aria-hidden />
                      )}
                      <span className="flex items-center gap-2.5">
                        <Icon {...ICON_PROPS} />
                        <span>{label}</span>
                      </span>
                      {badgeKey && summary[badgeKey] != null && (
                        <span
                          className={`text-[11px] px-2 py-0.5 min-w-[22px] text-center rounded-full transition-colors ${
                            isActive ? "bg-navy-500 text-white" : "bg-white/10 text-white/70"
                          }`}
                        >
                          {summary[badgeKey]}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-4 text-[11px] text-white/30 border-t border-white/10">Argo · v0.5</div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-navy text-white flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="md:hidden"><LogoMark /></div>
            <div className="text-sm text-slate-300 truncate">
              <span className="hidden sm:inline text-white/40">Fleet Management / </span>
              <span className="text-white">{CRUMBS[pathname] || ""}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <Bell size={18} strokeWidth={2} aria-hidden />
                {unread > 0 && (
                  <span className="absolute top-1 right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-gray-800 rounded-xl shadow-2xl ring-1 ring-gray-200 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="font-semibold text-sm text-gray-900">Notifications</span>
                    {unread > 0 && (
                      <button onClick={markAll} className="text-xs text-navy-600 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length === 0 && (
                      <div className="py-8 text-center text-sm text-gray-400">You're all caught up.</div>
                    )}
                    {notifs.map((n) => (
                      <button
                        key={n.key}
                        onClick={() => markOne(n.key)}
                        className={`w-full text-left px-4 py-3 flex gap-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${n.is_read ? "" : "bg-navy-50/40"}`}
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${CATEGORY_DOT[n.category] || "bg-gray-300"}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                          <span className="block text-xs text-gray-500 mt-0.5">{n.message}</span>
                          <span className="block text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                        </span>
                        {!n.is_read && <span className="ml-auto mt-1.5 w-2 h-2 rounded-full bg-navy-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs text-white/60 capitalize hidden sm:inline">{user?.role}</span>
            <div className="w-8 h-8 rounded-full bg-navy-500 flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <LogOut size={14} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] z-40">
        {MOBILE_NAV.filter((item) => canAccess(user?.role, item.to)).map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 max-w-[88px] py-1.5 rounded-xl text-[11px] transition-colors ${
                isActive ? "text-navy-700 bg-navy-50 font-semibold" : "text-gray-400 hover:text-gray-600 active:bg-gray-50"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 2} aria-hidden />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
