// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import ClusterDetailPage from "./pages/ClusterDetailPage";
import ClusterPlaygroundPage from "./pages/ClusterPlaygroundPage";
import ManagersPage from "./pages/ManagersPage";
import MukkadamsListPage from "./pages/mukkadams/MukkadamsListPage";
import MukkadamDetailPage from "./pages/mukkadams/MukkadamDetailPage";
import AllocationsInsightsPage from "./pages/mukkadams/AllocationsInsightsPage";
import PaymentsPage from "./pages/PaymentsPage";
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
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<OverviewPage />} />
            <Route path="/mukkadams" element={<MukkadamsListPage />} />
            <Route path="/mukkadams/insights" element={<AllocationsInsightsPage />} />
            <Route path="/mukkadams/:id" element={<MukkadamDetailPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route
              path="/managers"
              element={
                <ProtectedRoute requireManagerTier>
                  <ManagersPage />
                </ProtectedRoute>
              }
            />
          </Route>

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
        </Routes>
        <BugReportGate />
      </BrowserRouter>
    </AuthProvider>
  );
}