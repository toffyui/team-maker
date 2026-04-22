export type Phase = "lobby" | "voting" | "results";

export type Participant = {
  id: string;
  name: string;
  teamId: string | null;
};

export type Team = {
  id: string;
  name: string;
  memberIds: string[];
};

export type Session = {
  id: string;
  phase: Phase;
  participants: Record<string, Participant>;
  teams: Record<string, Team>;
  votes: Record<string, string>;
};
