import { useEffect, useRef } from "react";

export type GameUpdate = {
  fen: string;
  lastMove?: [string, string];
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
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "sync" || data.type === "update") {
        onUpdateRef.current({ fen: data.fen, lastMove: data.lastMove });
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

  function sendFen(update: GameUpdate) {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected");
      return;
    }
    socket.send(JSON.stringify({ type: "move", roomId, ...update }));
  }

  return { sendFen };
}
