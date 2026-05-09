import React, { useState, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_SERVER_URL || "";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const { data } = await axios.post(`${API_URL}${endpoint}`, {
        username: form.username.trim().toLowerCase(),
        password: form.password.trim(),
      }, { timeout: 15000 });

      // 🔴 YOU MUST SEE THIS ALERT — proves new code is running
      alert("✅ API SUCCESS! Redirecting now...");
      
      localStorage.setItem("chatwave_token", data.token);
      localStorage.setItem("chatwave_user", JSON.stringify(data.user));
      
      // Hard redirect — full page reload, bypasses ALL React bugs
      window.location.replace("/");

    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
      setLoading(false);
      lock.current = false;
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#16162a", borderRadius: 24, padding: 32 }}>
        <h1 style={{ textAlign: "center", color: "#6c63ff" }}>ChatWave</h1>
        <p style={{ textAlign: "center", color: "#8888aa" }}>{isLogin ? "Sign In" : "Sign Up"}</p>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <input
            type="text" placeholder="Username" required
            value={form.username}
            onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #2a2a45", background: "#1e1e35", color: "#fff" }}
          />
          <input
            type="password" placeholder="Password" required
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #2a2a45", background: "#1e1e35", color: "#fff" }}
          />
          {error && <p style={{ color: "#ff6b6b", fontSize: 13, textAlign: "center" }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            style={{ padding: 12, borderRadius: 8, background: "linear-gradient(135deg, #6c63ff, #3ecfcf)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>
        
        <p style={{ textAlign: "center", color: "#8888aa", marginTop: 16 }}>
          {isLogin ? "Need an account? " : "Have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setError(""); }} style={{ background: "none", border: "none", color: "#6c63ff", cursor: "pointer" }}>
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}