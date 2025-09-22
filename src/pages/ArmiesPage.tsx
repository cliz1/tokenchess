// src/pages/ArmiesPage.tsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import ArmyBuilder from "../components/ArmyBuilder";

type Army = { id: string; name: string; data: { fen: string }; isPublic: boolean; createdAt: string };

export default function ArmiesPage() {
  const { user } = useAuth();
  const [armies, setArmies] = useState<Army[]>([]);
  const [selected, setSelected] = useState<number>(0); // index of selected army
  const [renaming, setRenaming] = useState<string>("");

  useEffect(() => { if (user) load(); else setArmies([]); }, [user]);

  async function load() {
    try {
      const res: Army[] = await apiFetch("/armies");

      // Ensure exactly 5 slots exist
      let list = res.slice(0, 5);
      while (list.length < 5) {
        const newArmy = await apiFetch("/armies", {
          method: "POST",
          body: JSON.stringify({
            name: `Draft ${list.length + 1}`,
            data: { fen: "8/8/8/8/8/8/8/8 w - - 0 1" }
          }),
        });
        list.push(newArmy);
      }

      setArmies(list);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function updateArmyFen(index: number, fen: string) {
    const army = armies[index];
    if (!army) return;
    try {
      const updated = await apiFetch(`/armies/${army.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...army, data: { fen } }),
      });
      const newArr = [...armies];
      newArr[index] = updated;
      setArmies(newArr);
    } catch (err: any) {
      console.error("Failed to update army FEN", err);
    }
  }

  async function renameArmy(index: number) {
    const army = armies[index];
    if (!army) return;
    try {
      const updated = await apiFetch(`/armies/${army.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...army, name: renaming }),
      });
      const newArr = [...armies];
      newArr[index] = updated;
      setArmies(newArr);
      setRenaming("");
    } catch (err: any) {
      alert(err.message);
    }
  }

  const current = armies[selected];

  return (
    <div style={{ padding: 20 }}>
      <h2>Your drafts</h2>
      {!user && <div>Please sign in to manage drafts.</div>}
      {user && (
        <>
          {/* Army slot selector */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {armies.map((a, i) => (
              <div
                key={a.id}
                onClick={() => setSelected(i)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: i === selected ? "#444" : "#222",
                  color: "#fff",
                }}
              >
                {a.name}
              </div>
            ))}
          </div>

          {/* Rename selected army */}
          {current && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={renaming}
                onChange={(e) => setRenaming(e.target.value)}
                placeholder={`Rename ${current.name}`}
              />
              <button onClick={() => renameArmy(selected)} style={{ marginLeft: 8 }}>
                Rename
              </button>
            </div>
          )}

          {/* Army Builder with auto-save */}
          {current && (
            <ArmyBuilder
              initialFen={current.data?.fen}
              onSave={(fen) => updateArmyFen(selected, fen)}
            />
          )}
        </>
      )}
    </div>
  );
}
