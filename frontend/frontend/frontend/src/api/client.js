import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  // Free-tier backends sleep when idle and can take 10-30s+ to wake up.
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fleet_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("fleet_token");
      localStorage.removeItem("fleet_user");
      if (location.pathname !== "/login") location.href = "/login";
    }
    // Network-level failure (no response): usually the free-tier server
    // waking up from sleep. Tag it so error messages can explain the wait.
    if (!err.response && err.code !== "ECONNABORTED") {
      err.serverColdStart = true;
    }
    return Promise.reject(err);
  }
);

export default api;
