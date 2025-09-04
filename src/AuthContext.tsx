// src/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";

type User = { id: string; email: string; username: string } | null;
const AuthContext = createContext<any>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  // bootstrap: if token present, fetch /me
  async function bootstrap() {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    try {
      const me = await apiFetch("/me");
      setUser(me);
    } catch {
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { bootstrap(); }, []);

  // login by username (client UI calls login(username, password))
  async function login(username: string, password: string) {
    // apiFetch will not attach Authorization (no token yet) — that's fine
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    // server should return { token, user }
    localStorage.setItem("token", res.token);
    setUser(res.user);
    return res;
  }

  // register(email, password, username) — matches your RegisterPage call order
  async function register(email: string, password: string, username?: string) {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, username }),
    });
    localStorage.setItem("token", res.token);
    setUser(res.user);
    return res;
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
