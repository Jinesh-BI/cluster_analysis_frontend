// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ClusterListPage from "./pages/ClusterListPage";
import ClusterDetailPage from "./pages/ClusterDetailPage";
import ClusterPlaygroundPage from "./pages/ClusterPlaygroundPage";
import ManagersPage from "./pages/ManagersPage";
import BugReportWidget from "./components/BugReportWidget";
import "./styles.css";

// TODO: fill in once confirmed — the bug_reports app's actual mount prefix.
const BUG_REPORTS_BASE = "https://ops.bharatintelligence.ai/bug-reports"; // <-- adjust

// Only renders once someone's actually logged in — the submit endpoint
// requires auth anyway, and there's nothing to report from the login screen.
function BugReportGate() {
  const { user } = useAuth();
  if (!user) return null;
  return <BugReportWidget domain="cluster_analysis" submitUrl={`${BUG_REPORTS_BASE}/submit/`} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ClusterListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clusters/:id"
            element={
              <ProtectedRoute>
                <ClusterDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clusters/:id/playground"
            element={
              <ProtectedRoute>
                <ClusterPlaygroundPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/managers"
            element={
              <ProtectedRoute requireManagerTier>
                <ManagersPage />
              </ProtectedRoute>
            }
          />
        </Routes>
        <BugReportGate />
      </BrowserRouter>
    </AuthProvider>
  );
}