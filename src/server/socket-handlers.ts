import type { Server } from "socket.io";
import type { Session } from "../lib/types";
import { store, generateTeams, assignToSmallestTeam } from "./store";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    socket.on(
      "session:join",
      ({
        sessionId,
        participantId,
        name,
      }: {
        sessionId: string;
        participantId: string;
        name: string | null;
      }) => {
        if (!sessionId || !participantId) return;
        const session = store.getOrCreate(sessionId);
        socket.join(sessionId);

        if (name && !session.participants[participantId]) {
          const trimmed = name.trim().slice(0, 50);
          if (trimmed) {
            session.participants[participantId] = {
              id: participantId,
              name: trimmed,
              teamId: null,
            };
            if (session.phase !== "lobby") {
              assignToSmallestTeam(session, participantId);
            }
          }
        }

        broadcastState(io, session);
      },
    );

    socket.on(
      "session:setName",
      ({
        sessionId,
        participantId,
        name,
      }: {
        sessionId: string;
        participantId: string;
        name: string;
      }) => {
        const session = store.get(sessionId);
        if (!session) return;
        const trimmed = name.trim().slice(0, 50);
        if (!trimmed) return;

        const existing = session.participants[participantId];
        if (existing) {
          existing.name = trimmed;
        } else {
          session.participants[participantId] = {
            id: participantId,
            name: trimmed,
            teamId: null,
          };
          if (session.phase !== "lobby") {
            assignToSmallestTeam(session, participantId);
          }
        }

        broadcastState(io, session);
      },
    );

    socket.on(
      "session:generateTeams",
      ({
        sessionId,
        groupCount,
      }: {
        sessionId: string;
        groupCount: number;
      }) => {
        const session = store.get(sessionId);
        if (!session) return;
        const count = Math.max(1, Math.min(20, Math.floor(groupCount)));
        const total = Object.keys(session.participants).length;
        if (total < count) return;

        generateTeams(session, count);
        session.phase = "voting";
        session.votes = {};

        broadcastState(io, session);
      },
    );

    socket.on(
      "session:vote",
      ({
        sessionId,
        participantId,
        teamId,
      }: {
        sessionId: string;
        participantId: string;
        teamId: string;
      }) => {
        const session = store.get(sessionId);
        if (!session) return;
        if (session.phase !== "voting") return;
        const participant = session.participants[participantId];
        if (!participant) return;
        if (!session.teams[teamId]) return;
        if (participant.teamId === teamId) return;
        if (session.votes[participantId]) return;

        session.votes[participantId] = teamId;

        const eligibleVoters = Object.values(session.participants).filter(
          (p) => p.teamId !== null,
        );
        const allVoted =
          eligibleVoters.length > 0 &&
          eligibleVoters.every((p) => session.votes[p.id]);
        if (allVoted) {
          session.phase = "results";
        }

        broadcastState(io, session);
      },
    );

    socket.on(
      "session:openResults",
      ({ sessionId }: { sessionId: string }) => {
        const session = store.get(sessionId);
        if (!session) return;
        if (session.phase !== "voting") return;
        session.phase = "results";
        broadcastState(io, session);
      },
    );

    socket.on("session:reset", ({ sessionId }: { sessionId: string }) => {
      const session = store.get(sessionId);
      if (!session) return;
      session.phase = "lobby";
      session.teams = {};
      session.votes = {};
      for (const p of Object.values(session.participants)) {
        p.teamId = null;
      }
      broadcastState(io, session);
    });
  });
}

function broadcastState(io: Server, session: Session) {
  io.to(session.id).emit("session:state", session);
}
