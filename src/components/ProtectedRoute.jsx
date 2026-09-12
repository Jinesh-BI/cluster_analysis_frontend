// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, requireManagerTier = false }) {
  const { user, isManagerTier } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (requireManagerTier && !isManagerTier) return <Navigate to="/" replace />;
  return children;
}
