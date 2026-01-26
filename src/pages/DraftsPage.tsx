// src/pages/DraftsPage.tsx
import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import DraftBuilder from "../components/DraftBuilder";

type Draft = { 
  id: string; 
  name: string; 
  data: { fen: string }; 
  isPublic: boolean; 
  createdAt: string; 
  isActive: boolean; 
  slot: number; 
};

export default function DraftsPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<number>(0); // slot index 0..4
  const [renaming, setRenaming] = useState<string>("");

  useEffect(() => { 
    if (user) load(); 
    else setDrafts([]); 
  }, [user]);

  async function load() {
    try {
      // server already returns slot-ordered (1..5)
      const res: Draft[] = await apiFetch("/drafts");

      const slots: Draft[] = new Array(5).fill(null);

      // Place returned drafts
      for (const d of res) {
        slots[d.slot - 1] = d;
      }

      // Create placeholders for empty slots
      for (let i = 0; i < 5; i++) {
        if (!slots[i]) {
          const slotNum = i + 1;
          const newDraft = await apiFetch("/drafts", {
            method: "POST",
            body: JSON.stringify({
              slot: slotNum,
              name: `Draft ${slotNum}`,
              data: { fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1" }
            }),
          });
          slots[i] = newDraft;
        }
      }

      setDrafts(slots);
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
        body: JSON.stringify({ data: { fen } }),
      });

      const copy = [...drafts];
      copy[index] = updated;
      setDrafts(copy);
    } catch (err) {
      console.error("Failed to update draft FEN", err);
    }
  }

  async function renameDraft(index: number) {
    const draft = drafts[index];
    if (!draft) return;

    try {
      const updated = await apiFetch(`/drafts/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: renaming }),
      });

      const copy = [...drafts];
      copy[index] = updated;
      setDrafts(copy);
      setRenaming("");
    } catch (err: any) {
      alert(err.message);
    }
  }

  const current = drafts[selected];

  return (
    <div style={{ padding: 20 }}>
      {!user && <div>Please sign in to manage drafts.</div>}

      {user && (
        <>
          {/* Slot selector */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {drafts.map((d, i) => (
              <div
                key={d.id}
                onClick={() => setSelected(i)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: d.isActive
                    ? "#2a7"
                    : i === selected
                    ? "#444"
                    : "#222",
                  color: "#fff",
                }}
              >
                {d.name}
              </div>
            ))}
          </div>

          {/* Rename + Set Active */}
          {current && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={renaming}
                onChange={(e) => setRenaming(e.target.value)}
                placeholder={`Rename ${current.name}`}
              />
              <button onClick={() => renameDraft(selected)} style={{ marginLeft: 8 }}>
                Rename
              </button>

              <button
                onClick={async () => {
                  try {
                    await apiFetch(`/drafts/${current.id}`, {
                      method: "PUT",
                      body: JSON.stringify({ isActive: true }),
                    });
                    await load();
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
                style={{ marginLeft: 8 }}
              >
                {current.isActive ? "Active" : "Activate"}
              </button>
            </div>
          )}

          {/* Draft Builder */}
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
