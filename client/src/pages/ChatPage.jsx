import React, { useState } from "react";
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    try {
      const { data } = await axios.post(`${API_URL}${endpoint}`, form);
      login(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#16162a", borderRadius: 24, padding: 32, boxShadow: "0 20px 60px rgba(108,99,255,0.3)", border: "1px solid #2a2a45" }}>

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28, gap: 10 }}>
          <AppLogo size={60} />
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, background: "linear-gradient(135deg, #6c63ff, #3ecfcf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ChatWave</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#8888aa" }}>
            {isLogin ? "Welcome back 👋" : "Create your account 🚀"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#8888aa", marginBottom: 6 }}>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Enter your username"
              style={{ width: "100%", background: "#1e1e35", border: "1px solid #2a2a45", borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "#e8e8ff", outline: "none", transition: "border 0.2s" }}
              onFocus={(e) => e.target.style.borderColor = "#6c63ff"}
              onBlur={(e) => e.target.style.borderColor = "#2a2a45"}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#8888aa", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter your password"
              style={{ width: "100%", background: "#1e1e35", border: "1px solid #2a2a45", borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "#e8e8ff", outline: "none", transition: "border 0.2s" }}
              onFocus={(e) => e.target.style.borderColor = "#6c63ff"}
              onBlur={(e) => e.target.style.borderColor = "#2a2a45"}
              required
            />
          </div>

          {error && <p style={{ margin: 0, color: "#ff6b6b", fontSize: 13, textAlign: "center" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", background: "linear-gradient(135deg, #6c63ff, #3ecfcf)", color: "white", border: "none", borderRadius: 12, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#8888aa", marginTop: 20 }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            style={{ background: "none", border: "none", color: "#6c63ff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}
