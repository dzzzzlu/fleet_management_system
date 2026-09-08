import { Link } from "react-router-dom";
import {
  Truck, Route, Wrench, Fuel, ShieldCheck, BarChart3, ArrowRight, MapPin, Users, Clock,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const FEATURES = [
  { Icon: Route, title: "Dispatch & Trips", desc: "Plan, start and complete trips with live odometer tracking." },
  { Icon: Wrench, title: "Maintenance", desc: "Schedule services and auto-update vehicle availability." },
  { Icon: Fuel, title: "Fuel Management", desc: "Auto-compute fuel cost from liters and per-liter price." },
  { Icon: ShieldCheck, title: "Role-Based Access", desc: "Admin, manager, staff, viewer and driver scopes." },
  { Icon: BarChart3, title: "Reports & Insights", desc: "Interactive analytics on fleet utilization and spend." },
  { Icon: Users, title: "Team & Vehicles", desc: "Assign vehicles to drivers with future-dated schedules." },
];

const STEPS = [
  { Icon: Users, title: "1. Set up your fleet", desc: "Add vehicles, drivers and user accounts." },
  { Icon: Truck, title: "2. Assign & dispatch", desc: "Schedule vehicles to drivers and log trips." },
  { Icon: BarChart3, title: "3. Track & report", desc: "Monitor maintenance, fuel and operational analytics." },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-navy-950/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
              <Truck size={20} strokeWidth={2.2} className="text-navy-950" aria-hidden />
            </div>
            <span className="font-bold text-lg tracking-tight">DazAutoTrack</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard" className="bg-brand-500 text-navy-950 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-brand-400 transition-colors">
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/80 hover:text-white px-3 py-2 font-medium">Login</Link>
                <Link to="/signup" className="bg-brand-500 text-navy-950 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-brand-400 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)", backgroundSize: "28px 28px" }}
          aria-hidden />
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-1 rounded-full mb-5">
              <Clock size={13} aria-hidden /> Fleet Operations Platform
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Logistics moves fast.{" "}
              <span className="text-brand-500">So should your fleet data.</span>
            </h1>
            <p className="text-white/60 text-lg mt-4 max-w-lg">
              Track vehicles, drivers, trips, maintenance and fuel in one dashboard —
              built for dispatchers, managers and drivers.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              {!user && (
                <>
                  <Link to="/signup" className="inline-flex items-center gap-2 bg-brand-500 text-navy-950 font-semibold px-6 py-3 rounded-xl hover:bg-brand-400 transition-colors">
                    Start your fleet <ArrowRight size={18} aria-hidden />
                  </Link>
                  <Link to="/login" className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-colors">
                    Explore with a demo login
                  </Link>
                </>
              )}
              {user && (
                <Link to="/dashboard" className="inline-flex items-center gap-2 bg-brand-500 text-navy-950 font-semibold px-6 py-3 rounded-xl hover:bg-brand-400 transition-colors">
                  Open Dashboard <ArrowRight size={18} aria-hidden />
                </Link>
              )}
            </div>
          </div>

          {/* Route visual */}
          <div className="hidden lg:block bg-white/5 border border-white/10 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6 text-sm font-medium text-white/70">
              <span>Fleet Overview</span>
              <span className="inline-flex items-center gap-1.5 text-brand-400"><MapPin size={14} aria-hidden /> Live</span>
            </div>
            <div className="space-y-4">
              {[
                { plate: "DAT-2401", from: "Manila", to: "Batangas", et: "12 min", c: "#f59e0b" },
                { plate: "NGP 1234", from: "Clark", to: "Laguna", et: "38 min", c: "#38bdf8" },
                { plate: "DAT-2402", from: "Subic", to: "Cavite", et: "1 h", c: "#a78bfa" },
              ].map((r) => (
                <div key={r.plate} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">{r.plate}</span>
                    <span className="text-xs text-white/50">{r.et}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span>{r.from}</span>
                    <span className="flex-1 mx-1" style={{ height: 2, background: `repeating-linear-gradient(to right, ${r.c} 0 8px, transparent 8px 14px)` }} />
                    <span>{r.to}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Everything your fleet needs</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-brand-500/15 flex items-center justify-center mb-4">
                <Icon size={22} strokeWidth={2} className="text-brand-500" aria-hidden />
              </div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-white/55 text-sm mt-1.5">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map(({ Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/15 flex items-center justify-center mb-4">
                  <Icon size={26} strokeWidth={2} className="text-brand-500" aria-hidden />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-white/55 text-sm mt-1.5 max-w-xs mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <Truck size={16} strokeWidth={2.2} className="text-navy-950" aria-hidden />
            </div>
            DazAutoTrack · Argo v0.5
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
            <Link to="/signup" className="hover:text-white transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}