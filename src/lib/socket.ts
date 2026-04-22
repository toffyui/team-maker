"use client";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function getOrCreateParticipantId(sessionId: string): string {
  const key = `team-maker:pid:${sessionId}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(key, fresh);
  return fresh;
}
