import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("chatwave_token"));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chatwave_user")); } catch { return null; }
  });

  const login = (u, t) => {
    localStorage.setItem("chatwave_token", t);
    localStorage.setItem("chatwave_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("chatwave_token");
    localStorage.removeItem("chatwave_user");
    setToken(null);
    setUser(null);
    window.location.replace("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}