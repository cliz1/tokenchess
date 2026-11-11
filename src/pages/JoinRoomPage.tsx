import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

// the code-entry form, shared by the /game/join page and the Play page
export function JoinForm({ compact = false }: { compact?: boolean } = {}) {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

async function handleJoin(e?: React.FormEvent) {
  e?.preventDefault();
  setError(null);

  const trimmed = roomId.trim();
  if (!trimmed) {
    setError("Enter a room code");
    return;
  }

  setLoading(true);
  try {
    // apiFetch will throw if the server returns !ok
    await apiFetch(`/rooms/${encodeURIComponent(trimmed)}`);

    navigate(`/game?room=${encodeURIComponent(trimmed)}`);
  } catch (err: any) {
    setError(err.message || "Unable to join");
  } finally {
    setLoading(false);
  }
}

  return (
    <>
      {compact ? (
        // inline: code field plus a small forward-arrow button
        <form onSubmit={handleJoin} style={{ display: "flex", gap: 8 }}>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ flex: 1, minWidth: 0, textTransform: "uppercase" }}
            placeholder="Room code"
            aria-label="Room code"
          />
          <button type="submit" disabled={loading} title="Join room" aria-label="Join room" style={{ padding: "6px 12px", fontSize: 18, lineHeight: 1, cursor: "pointer" }}>
            {loading ? "…" : "→"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin}>
          <label>
            Room code:
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={{ marginLeft: 8, textTransform: "uppercase" }}
              placeholder="Enter room code"
            />
          </label>
          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={loading}>
              {loading ? "Checking…" : "Join Room"}
            </button>
          </div>
        </form>
      )}
      {error && <div style={{ color: "salmon", marginTop: 12 }}>{error}</div>}
    </>
  );
}

export default function JoinRoomPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 20 }}>
      <button
        onClick={() => navigate("/")}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#aaa",
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        ← Back to Home
      </button>

      <h2>Join Game Room</h2>
      <JoinForm />
    </div>
  );
}
