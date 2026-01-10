// src/pages/LobbyPage.tsx
import { useEffect, useState} from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";


export default function LobbyPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    load();
    const id = setInterval(load, 2000); // simple polling
    return () => clearInterval(id);
  }, []);

  async function load() {
    const res = await apiFetch("/lobby");
    setRooms(res);
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Lobby</h2>

      <button onClick={async () => {
        const res = await apiFetch("/rooms", { method: "POST" });
        navigate(`/game?room=${res.roomId}`);
      }}>
        Create Game
      </button>

      <ul style={{ marginTop: 20 }}>
        {rooms.map(r => (
          <li
            key={r.roomId}
            onClick={() => navigate(`/game?room=${r.roomId}`)}
            style={{ cursor: "pointer" }}
          >
            {r.owner} — waiting for opponent
          </li>
        ))}
      </ul>
    </div>
  );
}
