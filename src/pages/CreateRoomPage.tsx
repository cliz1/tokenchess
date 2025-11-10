import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [length, setLength] = useState<number>(6);
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
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:4000/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ length }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to create room");
      }
      const body = await res.json();
      const roomId = body.roomId as string;
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
