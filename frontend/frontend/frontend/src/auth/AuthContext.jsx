import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("fleet_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("fleet_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => { setUser(r.data); localStorage.setItem("fleet_user", JSON.stringify(r.data)); })
      .catch(() => { logout(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveSession(data) {
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem("fleet_token", data.access_token);
    localStorage.setItem("fleet_user", JSON.stringify(data.user));
  }

  async function login(email, password) {
    const r = await api.post("/auth/login", { email, password });
    saveSession(r.data);
  }

  async function signup(payload) {
    const r = await api.post("/auth/signup", payload);
    return r.data;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("fleet_token");
    localStorage.removeItem("fleet_user");
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
