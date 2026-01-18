import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

 async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);

  try {
    await register(email, password, username);
    nav("/");
  } catch (err: any) {
    if (err.message === "USERNAME_TAKEN") {
      setError("That username is already taken.");
    } else if (err.message === "EMAIL_TAKEN") {
      setError("That email is already registered.");
    } else {
      setError("Something went wrong. Please try again.");
    }
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
    backgroundColor: "#4caf50",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 20 }}>Create Account</h2>
      {error && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 6,
            background: "#ffecec",
            color: "#a40000",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <div>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            type="email"
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
            Register
          </button>
        </div>
      </form>
    </div>
  );
}

