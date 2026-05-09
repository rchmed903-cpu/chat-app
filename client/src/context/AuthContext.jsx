import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("chatwave_token"));
  const [isReady, setIsReady] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("chatwave_token");
    const savedUser = localStorage.getItem("chatwave_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("chatwave_token");
        localStorage.removeItem("chatwave_user");
      }
    }
    setIsReady(true);
  }, []);

  const login = useCallback((userData, tokenValue) => {
    console.log("[AuthContext] login called", userData?.username);
    localStorage.setItem("chatwave_token", tokenValue);
    localStorage.setItem("chatwave_user", JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("chatwave_token");
    localStorage.removeItem("chatwave_user");
    setToken(null);
    setUser(null);
  }, []);

  if (!isReady) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0f1a",
        color: "#8888aa",
        fontFamily: "system-ui, sans-serif",
      }}>
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}