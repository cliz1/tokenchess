import { useCallback, useEffect, useRef } from "react";

export type GameUpdate = {
  fen: string;
  lastMove?: [string, string];
  role?: "player" | "spectator";
  color?: "white" | "black";
  result?: "1-0" | "0-1" | "1/2-1/2" | "ongoing";
};

export function useGameSocket(roomId: string, onUpdate: (update:GameUpdate) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // keep the last onUpdate callback so the socket doesn't need to be reset
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:4000");
    wsRef.current = ws;

    ws.onopen = () => {
      const token = localStorage.getItem("token");
      ws.send(JSON.stringify({ type: "join", roomId, token }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "sync" || data.type === "update") {
        onUpdateRef.current({ fen: data.fen, lastMove: data.lastMove, role: data.role, color: data.color });
      }
      else if (data.type === "gameOver") {
    onUpdateRef.current({ fen: data.fen, lastMove: data.lastMove, result: data.result, role: data.role, color: data.color });
  }   else if (data.type === "newGame") {
    onUpdateRef.current({ fen: data.fen, lastMove: data.lastMove, role: data.role, color: data.color });
  }
    };
    
    ws.onclose = () => {
        if (wsRef.current === ws) {
            wsRef.current = null;
        }
    }

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [roomId]);

  const sendMove = useCallback((lastMove: [string, string]) => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected");
      return;
    }
    socket.send(JSON.stringify({ type: "move", lastMove }));
  }, [])

  const sendRematch = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "rematch" }));
  }, []);

  const sendLeave = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "leave" }));
  }, []);

  return { sendMove, sendRematch, sendLeave };
}