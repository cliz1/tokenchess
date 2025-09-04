import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";

type Deck = { id: string; name: string; data: any; isPublic: boolean; createdAt: string };

export default function DecksPage() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [name, setName] = useState("");

  useEffect(() => { if (user) load(); else setDecks([]); }, [user]);

  async function load() {
    try {
      const res = await apiFetch("/decks");
      setDecks(res);
    } catch (err: any) { alert(err.message); }
  }

  async function createDeck() {
    try {
      const res = await apiFetch("/decks", { method: "POST", body: JSON.stringify({ name, data: { fen: "8/8/8/8/8/8/8/8 w - - 0 1" } })});
      setName("");
      setDecks([res, ...decks]);
    } catch (err:any) { alert(err.message); }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Your Decks</h2>
      {!user && <div>Please sign in to manage decks.</div>}
      {user && (
        <>
          <div style={{ marginBottom: 8 }}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="New deck name" />
            <button onClick={createDeck} style={{ marginLeft: 8 }}>Create</button>
          </div>
          <ul>
            {decks.map(d => <li key={d.id}><strong>{d.name}</strong> — <small>{new Date(d.createdAt).toLocaleString()}</small></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
