import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!roomId.trim()) {
      setError("Enter a room code");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/rooms/${encodeURIComponent(roomId.trim())}`);
      if (!res.ok) throw new Error("Room not found");
      navigate(`/game?room=${encodeURIComponent(roomId.trim())}`);
    } catch (err: any) {
      setError(err.message || "Unable to join");
    } finally {
      setLoading(false);
    }
  }

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
      {error && <div style={{ color: "salmon", marginTop: 12 }}>{error}</div>}
    </div>
  );
}
