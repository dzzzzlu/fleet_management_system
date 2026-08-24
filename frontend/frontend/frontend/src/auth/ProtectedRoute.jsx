import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canAccess } from "./permissions";

export default function ProtectedRoute({ children }) {
  const { user, token, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading...</div>;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!canAccess(user.role, pathname)) return <Navigate to="/" replace />;

  return children;
}
