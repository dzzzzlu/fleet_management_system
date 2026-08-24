import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage, getErrorDebug } from "../utils/errors";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
      setDebug(getErrorDebug(err));
      setBusy(false);
      return;
    }
    navigate("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={onSubmit} className="bg-white shadow rounded-xl p-8 w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center text-center gap-2 mb-2">
          <div className="w-12 h-12 bg-navy-600 rounded-xl flex items-center justify-center">
            <Truck size={26} strokeWidth={2.2} className="text-white" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Fleet Management Login</h1>
          <p className="text-xs text-gray-400">Argo Fleet Management Module</p>
        </div>
        {error && (
          <div className="text-sm text-red-600">
            {error}
            {debug && <div className="text-xs text-gray-400 mt-1">{debug}</div>}
          </div>
        )}
        <div>
          <label className="text-sm text-gray-600">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2.5 mt-1" autoComplete="email" />
        </div>
        <div>
          <label className="text-sm text-gray-600">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2.5 mt-1" autoComplete="current-password" />
        </div>
        <button disabled={busy} className="w-full bg-navy-600 text-white rounded py-3 text-sm font-medium disabled:opacity-50 hover:bg-navy-700 transition-colors">
          {busy ? "Logging in..." : "Log In"}
        </button>
        <p className="text-sm text-gray-500 text-center">
          No account? <Link to="/signup" className="text-navy-700 font-medium hover:text-navy-900">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
