import { useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TutorialsPage from "./pages/TutorialsPage";
import BoardEditor from "./components/BoardEditor";
import DraftBuilder from "./components/DraftBuilder";
import AnalysisBoard from "./components/AnalysisBoard";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DraftsPage from "./pages/DraftsPage";
import GamePage from "./pages/GamePage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import PuzzlesPage from "./pages/PuzzlesPage";
import LobbyPage from "./pages/LobbyPage";
import GamesPage from "./pages/GamesPage";

import "./App.css";

function AnalysisRouteWrapper() {
  const location = useLocation();
  const state = location.state as any;
  const initialFen = state?.initialFen ?? "4k3/8/2b3l1/8/8/2S3N1/8/4K3";
  const initialMoves = state?.initialMoves ?? [];
  const orientation = state?.orientation ?? "white";

  return (
    <AnalysisBoard
      initialFen={initialFen}
      initialMoves={initialMoves}
      orientation={orientation}
    />
  );
}

function EditorRouteWrapper() {
  const location = useLocation();
  const initialFen =
    (location.state && (location.state as any).initialFen) ??
    "8/8/8/8/8/8/8/8 w - - 0 1";

  return <BoardEditor initialFen={initialFen} />;
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
    <NavLink to="/games" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>My Games</NavLink>
      <NavLink to="/drafts" style={({isActive}) => ({ color: isActive ? "#fff" : "#aaa" })}>My Drafts</NavLink>
      <button onClick={logout} style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}>Logout</button>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppContent() {
  const location = useLocation();
  // Hide nav + footer on any `/game` route
  const hideNav = location.pathname === "/game";
useEffect(() => {
  const isGame = location.pathname === ("/game");
  const isHome = location.pathname === "/";
  const isPuzzle = location.pathname.startsWith("/puzzles");
  const isTutorials = location.pathname.startsWith("/tutorials");
  const shouldLock = isGame || isHome || isPuzzle || isTutorials;

  if (shouldLock) {
    document.body.style.overflow = "hidden";  // disable scroll
  } else {
    document.body.style.overflow = "auto";    // restore
  }

  return () => { document.body.style.overflow = "auto"; };
}, [location.pathname]);


  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {!hideNav && (
        <header style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="app-container" style={{ display: "flex", alignItems: "center" }}>
          <nav style={{ display: "flex", gap: 12, alignItems: "center", width:"100%" }}>
            <NavLink to="/" end style={({ isActive }) => ({ color: isActive ? "#fff" : "#aaa" })}>Home</NavLink>
            <NavLink to="/tutorials" style={({ isActive }) => ({ color: isActive ? "#fff" : "#aaa" })}>About</NavLink>
            <NavLink to="/editor" style={({ isActive }) => ({ color: isActive ? "#fff" : "#aaa" })}>Board</NavLink>
            <div style={{ position: "relative" }} className="play-menu">
  <span
    style={{
      color: location.pathname.startsWith("/game") ? "#fff" : "#aaa",
      cursor: "pointer",
      userSelect: "none",
    }}
    onClick={() => {
      const menu = document.querySelector(".play-dropdown") as HTMLElement | null;
      if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
    }}
  >
    Play ▾
  </span>
  <div
    className="play-dropdown"
    style={{
      position: "absolute",
      top: "100%",
      left: 0,
      background: "rgba(30,30,30,0.95)",
      border: "1px solid rgba(255,255,255,0.05)",
      borderRadius: 6,
      display: "none",
      flexDirection: "column",
      padding: 4,
      minWidth: 130,
      zIndex: 100,
    }}
  >
    <NavLink
      to="/lobby"
      style={({ isActive }) => ({
        color: isActive ? "#fff" : "#aaa",
        textDecoration: "none",
        padding: "6px 10px",
        display: "block",
      })}
      onClick={() => (document.querySelector(".play-dropdown") as HTMLElement | null)?.style.setProperty("display", "none")}
    >
      Game Lobby
    </NavLink>
    <NavLink
      to="/game/join"
      style={({ isActive }) => ({
        color: isActive ? "#fff" : "#aaa",
        textDecoration: "none",
        padding: "6px 10px",
        display: "block",
      })}
      onClick={() => (document.querySelector(".play-dropdown") as HTMLElement | null)?.style.setProperty("display", "none")}
    >
      Join by Code
    </NavLink>
        <NavLink
      to="/puzzles"
      style={({ isActive }) => ({
        color: isActive ? "#fff" : "#aaa",
        textDecoration: "none",
        padding: "6px 10px",
        display: "block",
      })}
      onClick={() => (document.querySelector(".play-dropdown") as HTMLElement | null)?.style.setProperty("display", "none")}
    >
      Puzzles
    </NavLink>
  </div>
</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
              <AuthNav />
            </div>
          </nav>
          </div>
        </header>
      )}

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analysis" element={<AnalysisRouteWrapper />} />
          <Route path="/editor" element={<EditorRouteWrapper />} />
          <Route path="/draft" element={<DraftBuilder />} />
          <Route path="/tutorials/*" element={<TutorialsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/drafts" element={<DraftsPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/game/create" element={<CreateRoomPage />} />
          <Route path="/game/join" element={<JoinRoomPage />} />
          <Route path="/puzzles" element={<PuzzlesPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/games" element={<GamesPage />} />
        </Routes>
      </main>
    </div>
  );
}
