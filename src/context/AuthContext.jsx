// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("ca_user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem("ca_user", JSON.stringify(user));
    else localStorage.removeItem("ca_user");
  }, [user]);

  async function login(username, password) {
    const data = await api.login(username, password);
    localStorage.setItem("ca_token", data.token);
    setUser({ username: data.username, role: data.role });
  }

  function logout() {
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
