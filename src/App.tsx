import React from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TutorialsPage from "./pages/TutorialsPage";
import BoardEditor from "./components/BoardEditor";
import ArmyBuilder from "./components/ArmyBuilder";
import AnalysisBoard from "./components/AnalysisBoard";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ArmiesPage from "./pages/ArmiesPage";

import "./App.css";

function AnalysisRouteWrapper() {
  const location = useLocation();
  const initialFen =
    (location.state && (location.state as any).initialFen) ??
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/XXXAKXXX w - - 0 1";
  return <AnalysisBoard initialFen={initialFen} />;
}

function AuthNav() {
  const { user, logout } = useAuth();
  if (!user) {
    return (
      <>
        <NavLink to="/login" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Login</NavLink>
        <NavLink to="/register" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Sign up</NavLink>
      </>
    );
  }
  return (
    <>
      <NavLink to="/armies" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>My Drafts</NavLink>
      <button onClick={logout} style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}>Logout</button>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <header style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <NavLink to="/" end style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Home</NavLink>
              <NavLink to="/tutorials" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Tutorials</NavLink>
              <NavLink to="/analysis" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Analysis</NavLink>
              <NavLink to="/editor" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Board Editor</NavLink>
              <NavLink to="/army" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Draft</NavLink>

              <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
                <AuthNav />
              </div>
            </nav>
          </header>

          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/analysis" element={<AnalysisRouteWrapper />} />
              <Route path="/editor" element={<BoardEditor />} />
              <Route path="/army" element={<ArmyBuilder />} />
              <Route path="/tutorials/*" element={<TutorialsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/armies" element={<ArmiesPage />} />
            </Routes>
          </main>

          <footer style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center", fontSize: 12, color: "#999" }}>
            © Token Chess
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}


