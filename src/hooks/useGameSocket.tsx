import { useEffect, useRef } from "react";

export function useGameSocket(roomId: string, onUpdate: (fen: string) => void) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:4000");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "sync" || data.type === "update") {
        onUpdate(data.fen);
      }
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  function sendFen(fen: string) {
    wsRef.current?.send(JSON.stringify({ type: "move", roomId, fen }));
  }

  return { sendFen };
}
