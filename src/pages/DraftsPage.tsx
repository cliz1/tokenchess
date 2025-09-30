// src/pages/DraftsPage.tsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import DraftBuilder from "../components/DraftBuilder";

type Draft = { id: string; name: string; data: { fen: string }; isPublic: boolean; createdAt: string, isActive: boolean };

export default function DraftsPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<number>(0); // index of selected Draft
  const [renaming, setRenaming] = useState<string>("");

  useEffect(() => { if (user) load(); else setDrafts([]); }, [user]);

async function load() {
  try {
    const res: Draft[] = await apiFetch("/drafts");

    // Ensure stable order by createdAt (defensive — server should already do this)
    const sorted = res.slice().sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return ta - tb;
    });

    // Take first 5 (oldest first) then create placeholders for any missing slots
    const list = sorted.slice(0, 5);

    // If fewer than 5 drafts, create deterministic placeholders so slot positions are stable
    while (list.length < 5) {
      const slotIndex = list.length + 1; // 1..5
      const newDraft = await apiFetch("/drafts", {
        method: "POST",
        body: JSON.stringify({
          name: `Draft ${slotIndex}`,
          data: { fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1" }
        }),
      });
      list.push(newDraft);
    }

    setDrafts(list);
  } catch (err: any) {
    alert(err.message);
  }
}


  async function updateDraftFen(index: number, fen: string) {
    const draft = drafts[index];
    if (!draft) return;
    try {
      const updated = await apiFetch(`/drafts/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, data: { fen } }),
      });
      const newArr = [...drafts];
      newArr[index] = updated;
      setDrafts(newArr);
    } catch (err: any) {
      console.error("Failed to update draft FEN", err);
    }
  }

  async function renameDraft(index: number) {
    const draft = drafts[index];
    if (!draft) return;
    try {
      const updated = await apiFetch(`/drafts/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, name: renaming }),
      });
      const newArr = [...drafts];
      newArr[index] = updated;
      setDrafts(newArr);
      setRenaming("");
    } catch (err: any) {
      alert(err.message);
    }
  }

  const current = drafts[selected];

  return (
   <div style={{ padding: 20 }}>
  <h2>Your drafts</h2>
  {!user && <div>Please sign in to manage drafts.</div>}
  {user && (
    <>
      {/* Draft slot selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {drafts.map((a, i) => (
          <div
            key={a.id}
            onClick={() => setSelected(i)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              background: a.isActive
                ? "#2a7" 
                : i === selected
                ? "#444"
                : "#222",
              color: "#fff",
            }}
          >
            {a.name}
          </div>
        ))}
      </div>

      {/* Rename + Set Active controls */}
      {current && (
        <div style={{ marginBottom: 12 }}>
          <input
            value={renaming}
            onChange={(e) => setRenaming(e.target.value)}
            placeholder={`Rename ${current.name}`}
          />
          <button
            onClick={() => renameDraft(selected)}
            style={{ marginLeft: 8 }}
          >
            Rename
          </button>

<button
  onClick={async () => {
    try {
      await apiFetch(`/drafts/${current.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      });
      await load(); // refresh list so only one remains active
    } catch (err: any) {
      alert(err.message);
    }
  }}
  style={{ marginLeft: 8 }}
>
  {current.isActive ? "Active" : "Set Active"}
</button>

        </div>
      )}

      {/* Draft Builder with auto-save */}
      {current && (
        <DraftBuilder
          initialFen={current.data?.fen}
          onSave={(fen) => updateDraftFen(selected, fen)}
        />
      )}
    </>
  )}
</div>

  );
}
