import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../api";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [length] = useState<number>(6);
  const [anythingGoes, setAnythingGoes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!user) {
      setError("You must be logged in to create a room.");
      return;
    }
    setLoading(true);
    try {
      //const token = localStorage.getItem("token");
      const res = await apiFetch("/rooms", {
        method: "POST",
        body: JSON.stringify({ length, anythingGoes }),
      });
      const roomId = res.roomId;
      navigate(`/game?room=${encodeURIComponent(roomId)}`);
    } catch (err: any) {
      setError(err.message || "Create failed");
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

      <h2>Create Game Room</h2>
      <form onSubmit={handleCreate}>
        <label
          title="Disables piece quantity (horde) limits for both players' drafts. Token budget still applies."
        >
          Anything Goes:
          <input
            type="checkbox"
            checked={anythingGoes}
            onChange={(e) => setAnythingGoes(e.target.checked)}
            style={{ marginLeft: 5 }}
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create Room"}
          </button>
        </div>
      </form>
      {error && <div style={{ color: "salmon", marginTop: 12 }}>{error}</div>}
    </div>
  );
}
