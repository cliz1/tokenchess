// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TutorialsPage from "./pages/TutorialsPage";
import BoardEditor from "./components/BoardEditor";
import ArmyBuilder from "./components/ArmyBuilder"; 
import AnalysisBoard from "./components/AnalysisBoard"; 

import "./App.css";

function AnalysisRouteWrapper() {
  const location = useLocation();
  const initialFen =
    (location.state && (location.state as any).initialFen) ??
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/XXXAKXXX w - - 0 1";
  return <AnalysisBoard initialFen={initialFen} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <NavLink to="/" end style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Home</NavLink>
            <NavLink to="/analysis" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Analysis</NavLink>
            <NavLink to="/editor" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Board Editor</NavLink>
            <NavLink to="/army" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Army Builder</NavLink>
            <NavLink to="/tutorials" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>Tutorials</NavLink>
          </nav>
        </header>

        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/analysis" element={<AnalysisRouteWrapper />} />
            <Route path="/editor" element={<BoardEditor />} />
            <Route path="/army" element={<ArmyBuilder />} />
            <Route path="/tutorials/*" element={<TutorialsPage />} />
          </Routes>
        </main>

        <footer style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center", fontSize: 12, color: "#999" }}>
          © Token Chess
        </footer>
      </div>
    </BrowserRouter>
  );
}

