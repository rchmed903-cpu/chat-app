import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_SERVER_URL || "";

function AppLogo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="url(#lg2)" />
      <path d="M10 14h20M10 20h14M10 26h17" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="30" cy="26" r="5" fill="white"/>
      <circle cx="30" cy="26" r="2.5" fill="url(#lg2)"/>
      <defs>
        <linearGradient id="lg2" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#6c63ff"/>
          <stop offset="100%" stopColor="#3ecfcf"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 🔒 Critical: useRef blocks double-clicks synchronously (before React re-renders)
  const submitLock = useRef(false);
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const safeSetState = useCallback((setter, value) => {
    if (isMounted.current) setter(value);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    // Immediate synchronous lock — blocks even the fastest double-click
    if (submitLock.current) {
      console.log("[Auth] Submit blocked — already in progress");
      return;
    }
    submitLock.current = true;

    safeSetState(setError, "");
    safeSetState(setLoading, true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    // Clean inputs
    const payload = {
      username: form.username.trim().toLowerCase(),
      password: form.password.trim(),
    };

    // Client validation
    if (!payload.username || !payload.password) {
      safeSetState(setError, "Username and password are required");
      safeSetState(setLoading, false);
      submitLock.current = false;
      return;
    }

    if (payload.username.length < 2) {
      safeSetState(setError, "Username must be at least 2 characters");
      safeSetState(setLoading, false);
      submitLock.current = false;
      return;
    }

    if (payload.password.length < 3) {
      safeSetState(setError, "Password must be at least 3 characters");
      safeSetState(setLoading, false);
      submitLock.current = false;
      return;
    }

    try {
      console.log("[Auth] Sending request:", endpoint, payload.username);
      const { data } = await axios.post(`${API_URL}${endpoint}`, payload, {
        timeout: 15000, // 15 second timeout
        headers: { "Content-Type": "application/json" },
      });

      console.log("[Auth] Success:", data.user?.username);
      login(data.user, data.token);
      navigate("/");
    } catch (err) {
      console.error("[Auth] Error:", err.response?.status, err.response?.data);
      const msg = err.response?.data?.error
        || (err.code === "ECONNABORTED" ? "Request timed out. Try again." : "Something went wrong");
      safeSetState(setError, msg);
    } finally {
      safeSetState(setLoading, false);
      // Small delay before unlocking to prevent rapid-fire clicks
      setTimeout(() => {
        submitLock.current = false;
      }, 500);
    }
  }

  function toggleMode() {
    if (loading) return;
    setIsLogin((prev) => !prev);
    setError("");
    setForm({ username: "", password: "" });
  }

  const btnText = loading
    ? "Please wait..."
    : isLogin
    ? "Sign In"
    : "Create Account";

  const subtitle = isLogin
    ? "Welcome back 👋"
    : "Create your account 🚀";

  const toggleText = isLogin
    ? "Don't have an account? "
    : "Already have an account? ";

  const toggleBtnText = isLogin ? "Sign Up" : "Sign In";

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#16162a",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 20px 60px rgba(108,99,255,0.25)",
          border: "1px solid #2a2a45",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 28,
            gap: 10,
          }}
        >
          <AppLogo size={60} />
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              background: "linear-gradient(135deg, #6c63ff, #3ecfcf)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ChatWave
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#8888aa" }}>{subtitle}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          autoComplete="off"
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#8888aa",
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              Username
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, username: e.target.value }))
              }
              placeholder="Enter your username"
              disabled={loading}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#1e1e35",
                border: "1px solid #2a2a45",
                borderRadius: 12,
                padding: "11px 14px",
                fontSize: 14,
                color: "#e8e8ff",
                outline: "none",
                transition: "border 0.2s, box-shadow 0.2s",
                opacity: loading ? 0.6 : 1,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#6c63ff";
                e.target.style.boxShadow = "0 0 0 3px rgba(108,99,255,0.15)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#2a2a45";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "#8888aa",
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              Password
            </label>
            <input
              type="password"
              name="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder="Enter your password"
              disabled={loading}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#1e1e35",
                border: "1px solid #2a2a45",
                borderRadius: 12,
                padding: "11px 14px",
                fontSize: 14,
                color: "#e8e8ff",
                outline: "none",
                transition: "border 0.2s, box-shadow 0.2s",
                opacity: loading ? 0.6 : 1,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#6c63ff";
                e.target.style.boxShadow = "0 0 0 3px rgba(108,99,255,0.15)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#2a2a45";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {error && (
            <p
              style={{
                margin: 0,
                color: "#ff6b6b",
                fontSize: 13,
                textAlign: "center",
                background: "rgba(255,107,107,0.08)",
                padding: "8px 12px",
                borderRadius: 8,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading
                ? "linear-gradient(135deg, #4a4a6a, #2a8a8a)"
                : "linear-gradient(135deg, #6c63ff, #3ecfcf)",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "12px",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
              transition: "all 0.2s ease",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {btnText}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "#8888aa",
            marginTop: 20,
          }}
        >
          {toggleText}
          <button
            type="button"
            onClick={toggleMode}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              color: "#6c63ff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 13,
              opacity: loading ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {toggleBtnText}
          </button>
        </p>
      </div>
    </div>
  );
}