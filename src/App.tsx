// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TutorialsPage from "./pages/TutorialsPage";
import BoardEditor from "./components/BoardEditor";
import ArmyBuilder from "./components/ArmyBuilder"; // adjust if different
import AnalysisBoard from "./components/Knook"; // your existing analysis board (Knook)

import "./App.css";

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
            <Route path="/analysis" element={<AnalysisBoard initialFen="3k4/8/1m1i4/Y7/8/4C1W1/8/4K3 w - - 0 1" />} />
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

