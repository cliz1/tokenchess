import { useCallback, useEffect, useRef } from "react";

export type GameUpdate = {
  type: "sync" | "update" | "gameOver" | "newGame";
  fen: string;
  lastMove?: [string, string];
  role?: "player" | "spectator";
  color?: "white" | "black";
  result?: "1-0" | "0-1" | "1/2-1/2" | "ongoing";
  players?: { id: string; username: string }[];
  scores?: Record<string, number>;
};

export function useGameSocket(roomId: string, onUpdate: (update: GameUpdate) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep the latest callback reference
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:4000");
    wsRef.current = ws;

    ws.onopen = () => {
      const token = localStorage.getItem("token");
      ws.send(JSON.stringify({ type: "join", roomId, token }));

      // Ask for a sync after a short delay to avoid race conditions
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "sync-request", roomId }));
        }
      }, 200);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      //console.log("[WS INCOMING]", data);

      // Handle all known update types uniformly
      if (["sync", "update", "gameOver", "newGame"].includes(data.type)) {
        onUpdateRef.current({
          type: data.type,
          fen: data.fen,
          lastMove: data.lastMove,
          result: data.result,
          role: data.role,
          color: data.color,
          players: data.players,
          scores: data.scores,
        });
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [roomId]);

  const sendMove = useCallback((lastMove: [string, string, string?]) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected");
      return;
    }
    socket.send(JSON.stringify({ type: "move", lastMove }));
  }, []);

  const sendRematch = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "rematch" }));
  }, []);

  const sendLeave = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "leave" }));
  }, []);

  const sendResign = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "resign" }));
  }, []);

  const sendDraw = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "draw" }));
  }, []);

  return { sendMove, sendRematch, sendLeave, sendResign, sendDraw };
}
