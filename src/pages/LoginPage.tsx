import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(username, password); // pass username now
      nav("/"); // go home after login
    } catch (err: any) {
      alert(err.message);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    fontSize: "16px",
    borderRadius: 6,
    border: "1px solid #ccc",
    boxSizing: "border-box",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 0",
    fontSize: "16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#2196f3",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 20 }}>Sign In</h2>
      <form onSubmit={onSubmit}>
        <div>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            type="text"
            required
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <button type="submit" style={buttonStyle}>
            Log In
          </button>
        </div>
      </form>
    </div>
  );
}
