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

export function generateTeams(session: Session, groupCount: number) {
  const participantIds = Object.keys(session.participants);
  const shuffledIds = shuffle(participantIds);
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

export function assignToSmallestTeam(session: Session, participantId: string) {
  const teams = Object.values(session.teams);
  if (teams.length === 0) return;
  const smallest = teams.reduce((a, b) =>
    a.memberIds.length <= b.memberIds.length ? a : b,
  );
  smallest.memberIds.push(participantId);
  const participant = session.participants[participantId];
  if (participant) participant.teamId = smallest.id;
}
