export type RoomStatus = "open" | "playing" | "finished";

export type Room = {
  id: string;
  fen: string;
  status: RoomStatus;

  createdAt: number;

  players: string[];                 // user IDs
  usernames: Record<string, string>; // uid → username

  clients: Set<WebSocket>;

  result?: "1-0" | "0-1" | "1/2-1/2";
};

export const rooms = new Map<string, Room>();