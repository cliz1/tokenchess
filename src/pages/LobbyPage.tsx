// src/pages/LobbyPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

export default function LobbyPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [minutes, setMinutes] = useState(10); // default 10 min
  const [increment, setIncrement] = useState(0); // default 0 sec increment
  const [isPrivate, setIsPrivate] = useState(false); // default to public
  const navigate = useNavigate();

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    const res = await apiFetch("/lobby");
    setRooms(res);
  }

  async function createGame() {
    const res = await apiFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({
        length: minutes,
        increment, // seconds
        isPrivate
      }),
    });
    navigate(`/game?room=${res.roomId}`);
  }

  return (
    <div className="app-container" style={{ padding: 20 }}>
      <h2>Lobby</h2>

      <div style={{ marginBottom: 10 }}>
        <label>
          Minutes:
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            style={{ width: 60, marginLeft: 5 }}
          />
        </label>
        <label style={{ marginLeft: 10 }}>
          Increment (sec):
          <input
            type="number"
            min={0}
            value={increment}
            onChange={(e) => setIncrement(Number(e.target.value))}
            style={{ width: 60, marginLeft: 5 }}
          />
        </label>
           <label style={{ marginLeft: 10 }}>
          Private:
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            style={{ marginLeft: 5 }}
          />
        </label>
      </div>

      <button onClick={createGame}>Create Game</button>

    <ul
      style={{
        marginTop: 20,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 10, 
        maxWidth: 700,
        margin: "20px auto",
      }}
    >
      {rooms.map((r) => {
        const tc = r.timeControl
          ? `${r.timeControl.length}+${r.timeControl.increment}`
          : "—";

        return (
        <li
          key={r.roomId}
          onClick={() => navigate(`/game?room=${r.roomId}`)}
          className="lobby-card"
        >
          {/* LEFT: players / owner */}
          <div style={{ fontWeight: 600 }}>
            {r.status === "open"
              ? r.owner
              : r.players?.length === 2
              ? `${r.players[0]} vs ${r.players[1]}`
              : "In progress"}
          </div>

          {/* RIGHT: meta info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 18,
              color: "#aaa",
              whiteSpace: "nowrap",
            }}
          >
            <span>{tc}</span>
            <span>·</span>
            <span>
              {r.status === "open" ? "Waiting for opponent" : "In progress"}
            </span>
          </div>
        </li>

        );
      })}
    </ul>
    </div>
  );
}
