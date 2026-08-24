import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage, getErrorDebug } from "../utils/errors";
import api from "../api/client";

const JOINABLE_ROLES = ["staff", "manager", "driver", "viewer"];

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("create"); // "create" | "join"
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", phone: "",
    organization_name: "", organization_id: "", role: "staff",
    tax_id: "", agree_terms: false,
  });
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null); // { organization_id, organization_name }
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

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setDebug("");
    setBusy(true);

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
      setError(getErrorMessage(err, "Signup failed"));
      setDebug(getErrorDebug(err));
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white shadow rounded-lg p-8 w-full max-w-md text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Signed up successfully</h1>
          <p className="text-sm text-gray-600">
            Your account for <span className="font-medium">{success.organization_name}</span> has been created.
            Please log in to continue.
          </p>
          {mode === "create" && (
            <div className="bg-gray-50 rounded-lg p-3 text-left">
              <p className="text-xs text-gray-500 mb-1">Your Organization ID (share with team members):</p>
              <p className="text-sm font-mono font-medium text-gray-900 break-all">{success.organization_id}</p>
            </div>
          )}
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-navy-600 text-white rounded py-3 text-sm font-medium hover:bg-navy-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <form onSubmit={onSubmit} className="bg-white shadow rounded-lg p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Create Account</h1>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
            {debug && <div className="text-xs text-gray-400 mt-1">{debug}</div>}
          </div>
        )}

        <div className="flex gap-4 text-sm pt-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={mode === "create"} onChange={() => setMode("create")} />
            New organization
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={mode === "join"} onChange={() => setMode("join")} />
            Join existing
          </label>
        </div>

        {mode === "create" ? (
          <>
            <div>
              <label className="text-sm text-gray-600">Organization name</label>
              <input required value={form.organization_name}
                onChange={(e) => update("organization_name", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" placeholder="e.g. Metro Fleet Corp." />
              <p className="text-xs text-gray-400 mt-1">You'll become the Administrator of this organization.</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Admin full name</label>
              <input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Business email</label>
              <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Admin phone number</label>
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" placeholder="+63 9xx xxx xxxx" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Business Registration / Tax ID</label>
              <input value={form.tax_id} onChange={(e) => update("tax_id", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" placeholder="For verification purposes only" />
              <p className="text-xs text-gray-400 mt-1">This is for verification purposes only. No actual lookup is performed.</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Password (min 8 characters)</label>
              <input type="password" required minLength={8} value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" required checked={form.agree_terms}
                onChange={(e) => update("agree_terms", e.target.checked)}
                className="mt-0.5" />
              <span>
                I agree to the Terms of Service and confirm I am authorized to register this organization.
              </span>
            </label>
          </>
        ) : (
          <>
            <div>
              <label className="text-sm text-gray-600">Full name</label>
              <input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Phone number (optional)</label>
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" placeholder="+63 9xx xxx xxxx" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Password (min 8 characters)</label>
              <input type="password" required minLength={8} value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Organization ID</label>
              <input required value={form.organization_id}
                onChange={(e) => { update("organization_id", e.target.value); setOrgLookup(null); }}
                onBlur={lookupOrg}
                className="w-full border rounded px-3 py-2 mt-1 font-mono text-sm"
                placeholder="Ask your admin for the Organization ID" />
              {orgLookupLoading && <p className="text-xs text-gray-400 mt-1">Looking up organization...</p>}
              {orgLookup && !orgLookupLoading && (
                <p className="text-xs text-green-600 mt-1">Organization found: <span className="font-medium">{orgLookup.name}</span></p>
              )}
              {!orgLookup && !orgLookupLoading && form.organization_id.length >= 10 && (
                <p className="text-xs text-red-500 mt-1">Organization not found</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Ask your administrator for the Organization ID. You can find it on their Dashboard.
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Role</label>
              <select value={form.role} onChange={(e) => update("role", e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1">
                {JOINABLE_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </>
        )}

        <button disabled={busy} className="w-full bg-navy-600 text-white rounded py-3 text-sm font-medium disabled:opacity-50 hover:bg-navy-700 transition-colors">
          {busy ? "Creating account..." : "Sign Up"}
        </button>
        <p className="text-sm text-gray-500 text-center">
          Already have an account? <Link to="/login" className="text-navy-700 font-medium hover:text-navy-900">Log in</Link>
        </p>
      </form>
    </div>
  );
}
