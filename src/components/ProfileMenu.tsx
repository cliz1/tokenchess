// src/components/ProfileMenu.tsx — nav "Profile" button with a small preview popup
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import type { Profile } from "../utils/profile";
import { NameLine } from "./ProfileBadge";

export default function ProfileMenu() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // refetch each time it opens so edits and new results show up
  useEffect(() => {
    if (!open || !user) return;
    setFailed(false);
    apiFetch(`/users/${encodeURIComponent(user.username)}/profile`).then(setProfile).catch(() => setFailed(true));
  }, [open, user?.username]);

  if (!user) return null;
  const href = `/profile/${encodeURIComponent(user.username)}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ background: "transparent", border: "none", cursor: "pointer", color: location.pathname.startsWith("/profile") ? "#fff" : "#aaa", font: "inherit" }}
      >
        {user.username} ▾
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Profile preview"
          style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, width: 200, zIndex: 100, background: "rgba(30,30,30,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
        >
          {failed && <div style={{ color: "#c98a8a", fontSize: 13 }}>Couldn't load your profile.</div>}
          {!profile && !failed && <div style={{ color: "#888", fontSize: 13 }}>Loading…</div>}
          {profile && (
            <NameLine p={profile} size={16} />
          )}
          <Link to={href} style={{ textAlign: "center", padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)", color: "#ddd", fontSize: 13, textDecoration: "none" }}>
            Full profile
          </Link>
        </div>
      )}
    </div>
  );
}
