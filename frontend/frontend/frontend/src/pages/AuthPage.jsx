import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Truck, Mail, Lock, ArrowRight, Building2, User, Phone, Copy, Check, Loader2, UserPlus, LogIn } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage, getErrorDebug } from "../utils/errors";
import api from "../api/client";

const JOINABLE_ROLES = ["staff", "manager", "driver", "viewer"];

const inputCls =
  "w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition";
const labelCls = "block text-xs font-medium text-white/70 mb-1.5";

function Field({ label, icon: Icon, className = "", ...props }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" aria-hidden />
        )}
        <input {...props} className={`${Icon ? `${inputCls} pl-9` : inputCls} ${className}`} />
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginTab = location.pathname === "/login";

  // login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginDebug, setLoginDebug] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // signup state
  const [mode, setMode] = useState("create"); // "create" | "join"
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", phone: "",
    organization_name: "", organization_id: "", role: "staff",
    tax_id: "", agree_terms: false,
  });
  const [signupError, setSignupError] = useState("");
  const [signupDebug, setSignupDebug] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [success, setSuccess] = useState(null); // { organization_id, organization_name }
  const [copied, setCopied] = useState(false);
  const [orgLookup, setOrgLookup] = useState(null); // { id, name } or null
  const [orgLookupLoading, setOrgLookupLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function lookupOrg() {
    if (!form.organization_id || form.organization_id.length < 10) {
      setOrgLookup(null);
      return;
    }
    setOrgLookupLoading(true);
    try {
      const r = await api.get(`/auth/organization/${form.organization_id}`);
      setOrgLookup(r.data);
    } catch {
      setOrgLookup(null);
    } finally {
      setOrgLookupLoading(false);
    }
  }

  async function onLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoginDebug("");
    setLoginBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setLoginError(getErrorMessage(err, "Login failed"));
      setLoginDebug(getErrorDebug(err));
      setLoginBusy(false);
      return;
    }
    navigate("/dashboard");
  }

  async function onSignup(e) {
    e.preventDefault();
    setSignupError("");
    setSignupDebug("");
    setSignupBusy(true);

    const payload = {
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
      ...(mode === "create"
        ? { organization_name: form.organization_name, tax_id: form.tax_id || undefined }
        : { organization_id: form.organization_id, role: form.role }),
    };

    try {
      const result = await signup(payload);
      setSuccess(result);
    } catch (err) {
      setSignupError(getErrorMessage(err, "Signup failed"));
      setSignupDebug(getErrorDebug(err));
    } finally {
      setSignupBusy(false);
    }
  }

  function switchTab(next) {
    navigate(next);
  }

  function goBackToSignIn() {
    setSuccess(null);
    switchTab("/login");
    setEmail(form.email);
  }

  async function copyOrgId() {
    try {
      await navigator.clipboard.writeText(success.organization_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-navy-950 text-white py-10 px-4">
      {/* background flourish */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-40 w-[520px] h-[520px] rounded-full bg-brand-500/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_60%)]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Truck size={24} strokeWidth={2.2} className="text-navy-950" aria-hidden />
            </div>
            <span className="font-bold text-xl tracking-tight">DazAutoTrack</span>
          </div>
          <p className="text-sm text-white/60 mt-2">Fleet operations, simplified.</p>
        </div>

        <div className="bg-white/[0.04] backdrop-blur border border-white/10 rounded-2xl shadow-2xl p-7">
          {/* tab switcher */}
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
            <button
              onClick={() => switchTab("/login")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                isLoginTab ? "bg-brand-500 text-navy-950 shadow" : "text-white/70 hover:text-white"
              }`}
            >
              <LogIn size={16} aria-hidden /> Sign In
            </button>
            <button
              onClick={() => switchTab("/signup")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                !isLoginTab ? "bg-brand-500 text-navy-950 shadow" : "text-white/70 hover:text-white"
              }`}
            >
              <UserPlus size={16} aria-hidden /> Sign Up
            </button>
          </div>

          {isLoginTab ? (
            <>
              <form onSubmit={onLogin} className="space-y-4">
                <h2 className="text-lg font-semibold">Welcome back</h2>
                {loginError && (
                  <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    {loginError}
                    {loginDebug && <div className="text-xs text-white/40 mt-1">{loginDebug}</div>}
                  </div>
                )}
                <Field label="Email" icon={Mail} type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
                <Field label="Password" icon={Lock} type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
                <button disabled={loginBusy}
                  className="w-full flex items-center justify-center gap-2 bg-brand-500 text-navy-950 rounded-lg py-3 text-sm font-bold disabled:opacity-50 hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20">
                  {loginBusy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} aria-hidden />}
                  {loginBusy ? "Signing in..." : "Sign In"}
                </button>
              </form>
              <p className="text-center text-sm text-white/40 mt-6">
                New to DazAutoTrack?{" "}
                <button onClick={() => switchTab("/signup")} className="text-brand-400 font-medium hover:text-brand-300">
                  Create an account
                </button>
              </p>
            </>
          ) : success ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 bg-green-400/15 rounded-full flex items-center justify-center mx-auto">
                <Check size={28} className="text-green-400" />
              </div>
              <h2 className="text-lg font-semibold">Signed up successfully</h2>
              <p className="text-sm text-white/60">
                Your account for <span className="font-medium text-white">{success.organization_name}</span> has been created.
                Log in to continue.
              </p>
              {mode === "create" && (
                <div className="bg-white/5 rounded-xl p-4 text-left">
                  <p className="text-xs text-white/50 mb-1.5">Your Organization ID (share with team members)</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-mono text-brand-400 break-all">{success.organization_id}</p>
                    <button onClick={copyOrgId} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Copy">
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-white/70" />}
                    </button>
                  </div>
                </div>
              )}
              <button onClick={goBackToSignIn}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 text-navy-950 rounded-lg py-3 text-sm font-bold hover:bg-brand-400 transition-colors">
                <LogIn size={16} aria-hidden /> Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={onSignup} className="space-y-4">
              {signupError && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {signupError}
                  {signupDebug && <div className="text-xs text-white/40 mt-1">{signupDebug}</div>}
                </div>
              )}

              {/* create/join mode */}
              <div className="flex p-1 rounded-lg bg-white/5 border border-white/10">
                <button type="button" onClick={() => setMode("create")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "create" ? "bg-brand-500 text-navy-950" : "text-white/70 hover:text-white"}`}>
                  <span className="flex items-center justify-center gap-1.5"><Building2 size={15} aria-hidden /> New Organization</span>
                </button>
                <button type="button" onClick={() => setMode("join")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "join" ? "bg-brand-500 text-navy-950" : "text-white/70 hover:text-white"}`}>
                  <span className="flex items-center justify-center gap-1.5"><User size={15} aria-hidden /> Join Existing</span>
                </button>
              </div>

              {mode === "create" ? (
                <>
                  <Field label="Organization name" icon={Building2} required value={form.organization_name}
                    onChange={(e) => update("organization_name", e.target.value)} placeholder="e.g. Metro Fleet Corp." />
                  <Field label="Admin full name" icon={User} required value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)} placeholder="Your full name" />
                  <Field label="Business email" icon={Mail} type="email" required value={form.email}
                    onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" autoComplete="email" />
                  <Field label="Phone number" icon={Phone} type="tel" value={form.phone}
                    onChange={(e) => update("phone", e.target.value)} placeholder="+63 9xx xxx xxxx" />
                  <Field label="Business Registration / Tax ID" value={form.tax_id}
                    onChange={(e) => update("tax_id", e.target.value)} placeholder="For verification purposes only" />
                  <p className="text-xs text-white/40 -mt-1">This is for verification purposes only. No actual lookup is performed.</p>
                  <Field label="Password (min 8 characters)" icon={Lock} type="password" required minLength={8} value={form.password}
                    onChange={(e) => update("password", e.target.value)} placeholder="Create a password" autoComplete="new-password" />
                  <label className="flex items-start gap-2 text-sm text-white/70 cursor-pointer">
                    <input type="checkbox" required checked={form.agree_terms}
                      onChange={(e) => update("agree_terms", e.target.checked)} className="mt-0.5 accent-brand-500" />
                    <span>I agree to the Terms of Service and confirm I am authorized to register this organization.</span>
                  </label>
                </>
              ) : (
                <>
                  <Field label="Full name" icon={User} required value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)} placeholder="Your full name" />
                  <Field label="Email" icon={Mail} type="email" required value={form.email}
                    onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" autoComplete="email" />
                  <Field label="Phone number (optional)" icon={Phone} type="tel" value={form.phone}
                    onChange={(e) => update("phone", e.target.value)} placeholder="+63 9xx xxx xxxx" />
                  <Field label="Password (min 8 characters)" icon={Lock} type="password" required minLength={8} value={form.password}
                    onChange={(e) => update("password", e.target.value)} placeholder="Create a password" autoComplete="new-password" />
                  <Field label="Organization ID" icon={Building2} required value={form.organization_id}
                    onChange={(e) => { update("organization_id", e.target.value); setOrgLookup(null); }}
                    onBlur={lookupOrg} placeholder="Ask your admin for the Organization ID"
                    className="font-mono !pl-3 text-sm" />
                  <div className="-mt-1">
                    {orgLookupLoading && <p className="text-xs text-white/50">Looking up organization...</p>}
                    {orgLookup && !orgLookupLoading && (
                      <p className="text-xs text-green-400">Organization found: <span className="font-medium">{orgLookup.name}</span></p>
                    )}
                    {!orgLookup && !orgLookupLoading && form.organization_id.length >= 10 && (
                      <p className="text-xs text-red-400">Organization not found</p>
                    )}
                    <p className="text-xs text-white/40 mt-1">You can find it on your administrator's dashboard.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Role</label>
                    <select value={form.role} onChange={(e) => update("role", e.target.value)}
                      className={`${inputCls} bg-navy-900 text-white`}>
                      {JOINABLE_ROLES.map((r) => <option key={r} value={r} className="bg-navy-900">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                </>
              )}

              <button disabled={signupBusy}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 text-navy-950 rounded-lg py-3 text-sm font-bold disabled:opacity-50 hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20">
                {signupBusy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} aria-hidden />}
                {signupBusy ? "Creating account..." : "Sign Up"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-white/40 mt-6">
          <Link to="/" className="hover:text-white transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}