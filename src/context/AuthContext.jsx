// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";
import { analyticsLogger } from "../analytics/logger";
import { posthogEnabled } from "../analytics/posthog";
import { track, trackException } from "../analytics/track";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const posthog = usePostHog();
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("ca_user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("ca_user", JSON.stringify(user));
      if (posthogEnabled) posthog?.identify(user.username, { role: user.role });
    } else {
      localStorage.removeItem("ca_user");
    }
  }, [posthog, user]);

  async function login(username, password) {
    try {
      const data = await api.login(username, password);
      localStorage.setItem("ca_token", data.token);

      // Identity itself is handled by the effect above, which re-runs once
      // setUser below lands — this just resets before that if the browser
      // was previously identified as a different account.
      if (posthogEnabled && user?.username && user.username !== data.username) posthog?.reset();
      track(posthog, "user_logged_in", { role: data.role });
      analyticsLogger.info("authentication completed", { outcome: "success", role: data.role });

      setUser({ username: data.username, role: data.role });
    } catch (error) {
      trackException(posthog, error);
      analyticsLogger.error("authentication completed", {
        outcome: "failure",
        error_type: error?.name || "Error",
      });
      throw error;
    }
  }

  function logout() {
    track(posthog, "user_logged_out", { role: user?.role });
    if (posthogEnabled) posthog?.reset();
    localStorage.removeItem("ca_token");
    setUser(null);
  }

  // Admin and Regional Manager currently get identical access — see
  // ManagerProfile.is_manager_tier on the backend, which is the single
  // source of truth this mirrors.
  const isManagerTier = user?.role === "ADMIN" || user?.role === "REGIONAL_MANAGER";

  return (
    <AuthContext.Provider value={{ user, login, logout, isManagerTier }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
