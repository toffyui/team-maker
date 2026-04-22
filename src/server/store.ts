import type { Session } from "../lib/types";
import { animalNames } from "../lib/animals";

const sessions = new Map<string, Session>();

export const store = {
  get(id: string): Session | undefined {
    return sessions.get(id);
  },
  getOrCreate(id: string): Session {
    const existing = sessions.get(id);
    if (existing) return existing;
    const fresh: Session = {
      id,
      phase: "lobby",
      participants: {},
      teams: {},
      votes: {},
    };
    sessions.set(id, fresh);
    return fresh;
  },
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateTeams(session: Session, teamSize: number) {
  const assignable = Object.values(session.participants).filter(
    (p) => !p.isOrganizer,
  );
  const groupCount = Math.max(1, Math.ceil(assignable.length / teamSize));
  const shuffledIds = shuffle(assignable.map((p) => p.id));
  const animals = shuffle(animalNames).slice(0, groupCount);

  session.teams = {};
  for (const p of Object.values(session.participants)) {
    p.teamId = null;
  }

  const teams = animals.map((name, i) => ({
    id: `team-${i}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    memberIds: [] as string[],
  }));

  shuffledIds.forEach((pid, i) => {
    const team = teams[i % groupCount];
    team.memberIds.push(pid);
    const participant = session.participants[pid];
    if (participant) participant.teamId = team.id;
  });

  for (const t of teams) {
    session.teams[t.id] = t;
  }
}

export function assignToNamedTeam(
  session: Session,
  participantId: string,
  teamName: string | null,
) {
  const participant = session.participants[participantId];
  if (!participant) return;
  if (participant.isOrganizer) return;

  const currentTeam = participant.teamId
    ? session.teams[participant.teamId]
    : null;
  if (teamName !== null && currentTeam && currentTeam.name === teamName) {
    return;
  }

  if (currentTeam) {
    currentTeam.memberIds = currentTeam.memberIds.filter(
      (id) => id !== participantId,
    );
    if (currentTeam.memberIds.length === 0) {
      delete session.teams[currentTeam.id];
      for (const voter of Object.keys(session.votes)) {
        if (session.votes[voter] === currentTeam.id) {
          delete session.votes[voter];
        }
      }
    }
  }

  if (teamName === null) {
    participant.teamId = null;
    return;
  }

  let team = Object.values(session.teams).find((t) => t.name === teamName);
  if (!team) {
    const id = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    team = { id, name: teamName, memberIds: [] };
    session.teams[id] = team;
  }
  team.memberIds.push(participantId);
  participant.teamId = team.id;
}

export function assignToSmallestTeam(session: Session, participantId: string) {
  const participant = session.participants[participantId];
  if (!participant) return;
  if (participant.isOrganizer) return;
  const teams = Object.values(session.teams);
  if (teams.length === 0) return;
  const smallest = teams.reduce((a, b) =>
    a.memberIds.length <= b.memberIds.length ? a : b,
  );
  smallest.memberIds.push(participantId);
  participant.teamId = smallest.id;
}
