// src/pages/DraftsPage.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import DraftBuilder from "../components/DraftBuilder";

type Draft = {
  id: string;
  name: string;
  data: { fen: string; anythingGoes?: boolean };
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
  const [activating, setActivating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveFnRef = useRef<() => void>(() => {});

  const handleRegisterSave = useCallback((fn: () => void) => {
    saveFnRef.current = fn;
  }, []);
  const handleSavedChange = useCallback((s: boolean) => {
    setSavedFlash(s);
  }, []);

  useEffect(() => {
    if (user) load();
    else setDrafts([]);
  }, [user]);

  useEffect(() => {
    setRenaming("");
  }, [selected]);

  async function load() {
    try {
      // server already returns slot-ordered (1..5)
      const res: Draft[] = await apiFetch("/drafts");

      const slots: Draft[] = new Array(5).fill(null);

      // Place returned drafts
      for (const d of res) {
        slots[d.slot - 1] = d;
      }
      setDrafts(slots);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function updateDraftFen(index: number, fen: string, anythingGoes: boolean) {
    const draft = drafts[index];
    if (!draft) return;

    try {
      const updated = await apiFetch(`/drafts/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ data: { fen, anythingGoes } }),
      });

      const copy = [...drafts];
      copy[index] = updated;
      setDrafts(copy);
    } catch (err: any) {
      console.error("Failed to update draft FEN", err);
      alert(err.message ?? "Failed to save draft");
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

  async function activateCurrent() {
    const draft = drafts[selected];
    if (!draft || draft.isActive) return;

    setActivating(true);
    try {
      await apiFetch(`/drafts/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      });
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActivating(false);
    }
  }

  const current = drafts[selected];

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      {!user && <div>Please sign in to manage drafts.</div>}

      {user && (
        <>
          {/* Draft slot tabs */}
          <div className="draft-tabs">
            {drafts.map((d, i) => (
              <div
                key={d.id}
                className={`draft-tab${i === selected ? " is-selected" : ""}`}
                onClick={() => setSelected(i)}
              >
                {d.isActive && (
                  <span className="draft-tab-active-mark" title="Currently active draft">
                    ★
                  </span>
                )}
                <span>{d.name}</span>
                {d.data?.anythingGoes && <span className="draft-tab-ag">AG</span>}
              </div>
            ))}
          </div>

          {/* Consolidated action toolbar: rename, activate, save */}
          {current && (
            <div className="draft-toolbar">
              <input
                type="text"
                value={renaming}
                onChange={(e) => setRenaming(e.target.value)}
                placeholder={`Rename "${current.name}"`}
              />
              <button className="btn-ghost" onClick={() => renameDraft(selected)}>
                Rename
              </button>

              <div className="toolbar-divider" />

              <button
                className={current.isActive ? "btn-activated" : "btn-ghost"}
                onClick={activateCurrent}
                disabled={current.isActive || activating}
              >
                {current.isActive ? "★ Active" : activating ? "Activating…" : "Set Active"}
              </button>

              <div className="toolbar-divider" />

              <button className="btn-primary" onClick={() => saveFnRef.current()}>
                Save Draft
              </button>

              {savedFlash && <span className="saved-flash">Saved!</span>}
            </div>
          )}

          {/* Draft Builder */}
          {current && (
            <DraftBuilder
              initialFen={current.data?.fen}
              initialAnythingGoes={current.data?.anythingGoes}
              onSave={(fen, anythingGoes) => updateDraftFen(selected, fen, anythingGoes)}
              onRegisterSave={handleRegisterSave}
              onSavedChange={handleSavedChange}
            />
          )}
        </>
      )}
    </div>
  );
}
