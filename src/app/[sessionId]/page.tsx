"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Participant, Session, Team } from "@/lib/types";
import { getOrCreateParticipantId, getSocket } from "@/lib/socket";
import { animalNames } from "@/lib/animals";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = (params?.sessionId ?? "").toUpperCase();
  const wantsOrganizer = searchParams?.get("role") === "organizer";

  const [session, setSession] = useState<Session | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const pid = getOrCreateParticipantId(sessionId);
    setParticipantId(pid);

    const socket = getSocket();

    const onState = (next: Session) => {
      if (next.id === sessionId) setSession(next);
    };
    const onConnect = () => {
      setConnected(true);
      socket.emit("session:join", { sessionId, participantId: pid });
    };
    const onDisconnect = () => setConnected(false);

    socket.on("session:state", onState);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setConnected(true);
      socket.emit("session:join", { sessionId, participantId: pid });
    }

    return () => {
      socket.off("session:state", onState);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [sessionId]);

  const me = useMemo(() => {
    if (!session || !participantId) return null;
    return session.participants[participantId] ?? null;
  }, [session, participantId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${sessionId}`,
      );
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (!sessionId) return null;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            ← Home
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {me?.isOrganizer && (
              <span className="text-xs px-2 py-1 bg-amber-600 text-white font-semibold rounded uppercase tracking-wide">
                Organizer
              </span>
            )}
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Session
            </span>
            <code className="px-3 py-1 bg-slate-900 text-white font-mono font-bold tracking-widest rounded">
              {sessionId}
            </code>
            <button
              onClick={copyLink}
              className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-white transition"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </header>

        {!connected && (
          <div className="text-center text-sm text-slate-500 py-2">
            Connecting…
          </div>
        )}

        {session && participantId && (
          <>
            {!me && (
              <NameEntry
                sessionId={sessionId}
                participantId={participantId}
                asOrganizer={wantsOrganizer}
              />
            )}
            {me?.isOrganizer && (
              <OrganizerView
                session={session}
                me={me}
                participantId={participantId}
              />
            )}
            {me && !me.isOrganizer && session.phase === "lobby" && (
              <LobbyView session={session} me={me} />
            )}
            {me && !me.isOrganizer && session.phase === "voting" && (
              <VotingView
                session={session}
                me={me}
                participantId={participantId}
              />
            )}
            {me && !me.isOrganizer && session.phase === "results" && (
              <ResultsView session={session} />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-slate-900 mb-3">{children}</h2>
  );
}

function NameEntry({
  sessionId,
  participantId,
  asOrganizer,
}: {
  sessionId: string;
  participantId: string;
  asOrganizer: boolean;
}) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    getSocket().emit("session:setName", {
      sessionId,
      participantId,
      name: trimmed,
      isOrganizer: asOrganizer,
    });
  };

  return (
    <Card>
      <SectionTitle>
        {asOrganizer ? "Join as organizer" : "Enter your name"}
      </SectionTitle>
      {asOrganizer && (
        <p className="text-sm text-slate-600 mb-3">
          You won&apos;t be assigned to any team. You can generate teams
          manually and see voting progress.
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={asOrganizer ? "Your name (organizer)" : "Your name"}
          className={`flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 ${asOrganizer ? "focus:ring-amber-600" : "focus:ring-slate-900"}`}
          maxLength={50}
          autoFocus
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className={`px-5 py-3 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${asOrganizer ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-900 hover:bg-slate-800"}`}
        >
          Join
        </button>
      </form>
    </Card>
  );
}

function getVoterCounts(session: Session) {
  const participants = Object.values(session.participants).filter(
    (p) => !p.isOrganizer,
  );
  const eligible = participants.filter((p) => p.teamId !== null);
  const votedCount = eligible.filter((p) => session.votes[p.id]).length;
  return { eligible, votedCount, total: participants.length };
}

function getVoteTallies(session: Session) {
  const counts = new Map<string, number>();
  for (const teamId of Object.values(session.votes)) {
    counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  }
  return counts;
}

function LobbyView({ session, me }: { session: Session; me: Participant }) {
  const [teamSize, setTeamSize] = useState("4");
  const participants = Object.values(session.participants).filter(
    (p) => !p.isOrganizer,
  );
  const total = participants.length;

  const canGenerate = () => {
    const n = Number(teamSize);
    return Number.isFinite(n) && n >= 1 && n <= 50 && total >= 1;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate()) return;
    getSocket().emit("session:generateTeams", {
      sessionId: session.id,
      teamSize: Number(teamSize),
    });
  };

  return (
    <>
      <Card>
        <div className="flex items-baseline justify-between mb-3">
          <SectionTitle>
            Attendees{" "}
            <span className="text-slate-500 font-normal">({total})</span>
          </SectionTitle>
          <span className="text-sm text-slate-500">
            You are <strong className="text-slate-900">{me.name}</strong>
          </span>
        </div>
        <AttendeesList session={session} meId={me.id} />
      </Card>

      <Card>
        <SectionTitle>Divide into teams</SectionTitle>
        <form onSubmit={submit} className="flex gap-2 items-end">
          <label className="flex-1">
            <span className="block text-sm text-slate-600 mb-1">
              Team size (people per team)
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={!canGenerate()}
            className="px-5 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate teams
          </button>
        </form>
        {total > 0 && Number(teamSize) >= 1 && (
          <p className="mt-2 text-xs text-slate-500">
            {total} attendee{total === 1 ? "" : "s"} →{" "}
            {Math.ceil(total / Number(teamSize))} team
            {Math.ceil(total / Number(teamSize)) === 1 ? "" : "s"}.
          </p>
        )}
      </Card>
    </>
  );
}

function VotingView({
  session,
  me,
  participantId,
}: {
  session: Session;
  me: Participant;
  participantId: string;
}) {
  const teams = Object.values(session.teams);
  const myVote = session.votes[participantId] ?? null;
  const { eligible, votedCount } = getVoterCounts(session);
  const myTeam = me.teamId ? session.teams[me.teamId] : null;

  const vote = (teamId: string) => {
    if (myVote) return;
    if (me.teamId === teamId) return;
    getSocket().emit("session:vote", {
      sessionId: session.id,
      participantId,
      teamId,
    });
  };

  if (!myTeam) {
    return (
      <Card>
        <SectionTitle>Waiting for a team…</SectionTitle>
        <p className="text-sm text-slate-600">
          The organizer hasn&apos;t assigned you to a team yet. You&apos;ll see
          the voting options as soon as they do.
        </p>
        <div className="mt-4 text-sm text-slate-500">
          {votedCount} / {eligible.length} voted so far.
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <SectionTitle>Vote for the best team</SectionTitle>
          <span className="text-sm text-slate-500">
            {votedCount} / {eligible.length} voted
          </span>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          You are on <strong className="text-slate-900">{myTeam.name}</strong>.
          You cannot vote for your own team.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              session={session}
              isMyTeam={team.id === me.teamId}
              myVote={myVote}
              onVote={() => vote(team.id)}
            />
          ))}
        </div>

        {myVote && (
          <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            ✓ Your vote is recorded. Waiting for others…
          </p>
        )}
      </Card>
    </>
  );
}

function TeamCard({
  team,
  session,
  isMyTeam,
  myVote,
  onVote,
}: {
  team: Team;
  session: Session;
  isMyTeam: boolean;
  myVote: string | null;
  onVote: () => void;
}) {
  const members = team.memberIds
    .map((id) => session.participants[id])
    .filter(Boolean);
  const isMyVote = myVote === team.id;

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-3 ${
        isMyTeam
          ? "border-slate-900 bg-slate-50"
          : isMyVote
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{team.name}</h3>
        {isMyTeam && (
          <span className="text-xs px-2 py-0.5 bg-slate-900 text-white rounded">
            your team
          </span>
        )}
      </div>
      <ul className="text-sm text-slate-700 space-y-0.5">
        {members.map((m) => (
          <li key={m.id}>{m.name}</li>
        ))}
        {members.length === 0 && (
          <li className="text-slate-400 italic">no members yet</li>
        )}
      </ul>
      <button
        onClick={onVote}
        disabled={isMyTeam || !!myVote}
        className={`mt-auto px-3 py-2 rounded-md text-sm font-medium transition ${
          isMyTeam
            ? "bg-slate-200 text-slate-500 cursor-not-allowed"
            : isMyVote
              ? "bg-emerald-600 text-white cursor-default"
              : myVote
                ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {isMyTeam
          ? "Your team"
          : isMyVote
            ? "✓ Voted"
            : myVote
              ? "Vote cast"
              : `Vote for ${team.name}`}
      </button>
    </div>
  );
}

function AttendeesList({
  session,
  meId,
  votedIds,
}: {
  session: Session;
  meId: string;
  votedIds?: Set<string>;
}) {
  const participants = Object.values(session.participants).filter(
    (p) => !p.isOrganizer,
  );
  return (
    <ul className="space-y-1.5">
      {participants.map((p) => {
        const team = p.teamId ? session.teams[p.teamId] : null;
        const voted = votedIds?.has(p.id);
        return (
          <li
            key={p.id}
            className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 border border-slate-100"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{p.name}</span>
              {p.id === meId && (
                <span className="text-xs text-slate-500">(you)</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {team && (
                <span className="text-xs px-2 py-0.5 bg-slate-900 text-white rounded">
                  {team.name}
                </span>
              )}
              {voted !== undefined && (
                <span
                  className={`text-xs ${voted ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {voted ? "✓ voted" : "waiting"}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ResultsView({ session }: { session: Session }) {
  const teams = Object.values(session.teams);
  const counts = getVoteTallies(session);
  const maxCount = Math.max(0, ...teams.map((t) => counts.get(t.id) ?? 0));
  const ranked = [...teams].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
  );

  const reset = () => {
    if (!confirm("Start a new round? Teams and votes will be cleared.")) return;
    getSocket().emit("session:reset", { sessionId: session.id });
  };

  return (
    <Card>
      <SectionTitle>Results</SectionTitle>
      <ol className="space-y-2">
        {ranked.map((team, i) => {
          const count = counts.get(team.id) ?? 0;
          const isWinner = count > 0 && count === maxCount;
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <li
              key={team.id}
              className={`rounded-lg border p-3 ${
                isWinner
                  ? "border-amber-400 bg-amber-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 font-mono">
                    #{i + 1}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {team.name}
                  </span>
                  {isWinner && (
                    <span className="text-xs px-2 py-0.5 bg-amber-500 text-white rounded">
                      winner
                    </span>
                  )}
                </div>
                <span className="text-sm font-mono text-slate-700">
                  {count} {count === 1 ? "vote" : "votes"}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isWinner ? "bg-amber-500" : "bg-slate-700"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {team.memberIds
                  .map((id) => session.participants[id]?.name)
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex justify-end">
        <button
          onClick={reset}
          className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition"
        >
          Start new round
        </button>
      </div>
    </Card>
  );
}

function OrganizerView({
  session,
  me,
  participantId,
}: {
  session: Session;
  me: Participant;
  participantId: string;
}) {
  const [teamSize, setTeamSize] = useState("4");

  const participants = Object.values(session.participants).filter(
    (p) => !p.isOrganizer,
  );
  const organizers = Object.values(session.participants).filter(
    (p) => p.isOrganizer,
  );
  const teams = Object.values(session.teams);
  const { eligible, votedCount } = getVoterCounts(session);
  const tallies = getVoteTallies(session);

  const autoGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(teamSize);
    if (!Number.isFinite(n) || n < 1 || n > 50) return;
    if (participants.length < 1) return;
    if (
      teams.length > 0 &&
      !confirm(
        "This will clear current teams and votes and reshuffle everyone. Continue?",
      )
    )
      return;
    getSocket().emit("session:generateTeams", {
      sessionId: session.id,
      teamSize: n,
    });
  };

  const assign = (targetParticipantId: string, teamName: string | null) => {
    getSocket().emit("session:assign", {
      sessionId: session.id,
      targetParticipantId,
      teamName,
    });
  };

  const openResults = () => {
    getSocket().emit("session:openResults", { sessionId: session.id });
  };

  const reset = () => {
    if (!confirm("Reset the session? Teams, assignments, and votes will be cleared."))
      return;
    getSocket().emit("session:reset", { sessionId: session.id });
  };

  return (
    <>
      <Card>
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <SectionTitle>
            Organizer control — {me.name}{" "}
            <span className="text-slate-500 font-normal text-sm">(you)</span>
          </SectionTitle>
          <span className="text-sm text-slate-500">
            Phase:{" "}
            <span className="font-semibold text-slate-900">
              {session.phase}
            </span>
          </span>
        </div>
        {organizers.length > 1 && (
          <p className="text-xs text-slate-500 mb-2">
            Other organizers:{" "}
            {organizers
              .filter((o) => o.id !== participantId)
              .map((o) => o.name)
              .join(", ")}
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle>Random assign</SectionTitle>
        <form onSubmit={autoGenerate} className="flex gap-2 items-end">
          <label className="flex-1">
            <span className="block text-sm text-slate-600 mb-1">
              Team size (people per team)
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={participants.length < 1 || Number(teamSize) < 1}
            className="px-4 py-2 bg-slate-900 text-white font-semibold rounded hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Shuffle
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          {participants.length} attendee
          {participants.length === 1 ? "" : "s"} →{" "}
          {participants.length > 0 && Number(teamSize) >= 1
            ? Math.ceil(participants.length / Number(teamSize))
            : 0}{" "}
          team
          {participants.length > 0 &&
          Math.ceil(participants.length / Number(teamSize)) === 1
            ? ""
            : "s"}
          . Or skip this and assign each person to a team below.
        </p>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <SectionTitle>
            Attendees{" "}
            <span className="text-slate-500 font-normal">
              ({participants.length})
            </span>
          </SectionTitle>
          {session.phase === "voting" && (
            <span className="text-sm text-slate-500">
              {votedCount} / {eligible.length} voted
            </span>
          )}
        </div>
        {participants.length === 0 ? (
          <p className="text-sm text-slate-500">
            No attendees have joined yet. Share session code{" "}
            <code className="font-mono font-bold">{session.id}</code>.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {participants.map((p) => {
              const currentTeam = p.teamId ? session.teams[p.teamId] : null;
              const hasVoted = !!session.votes[p.id];
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-slate-50 border border-slate-100"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-900 truncate">
                      {p.name}
                    </span>
                    {session.phase === "voting" && (
                      <span
                        className={`text-xs ${hasVoted ? "text-emerald-600" : "text-slate-400"}`}
                      >
                        {hasVoted ? "✓ voted" : "waiting"}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentTeam?.name ?? ""}
                      onChange={(e) => assign(p.id, e.target.value || null)}
                      className="text-sm px-2 py-1 border border-slate-300 rounded bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600"
                    >
                      <option value="">— unassigned —</option>
                      {animalNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {teams.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <SectionTitle>Teams</SectionTitle>
            {session.phase === "voting" && (
              <button
                onClick={openResults}
                className="text-sm px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 transition"
              >
                Open results now
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => {
              const members = team.memberIds
                .map((id) => session.participants[id])
                .filter(Boolean);
              const count = tallies.get(team.id) ?? 0;
              return (
                <div
                  key={team.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-slate-900">
                      {team.name}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {members.length} member
                      {members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="text-sm text-slate-700 space-y-0.5">
                    {members.length === 0 ? (
                      <li className="text-slate-400 italic">no members</li>
                    ) : (
                      members.map((m) => <li key={m.id}>{m.name}</li>)
                    )}
                  </ul>
                  {(session.phase === "voting" ||
                    session.phase === "results") && (
                    <div className="mt-2 text-xs text-slate-600">
                      {count} vote{count === 1 ? "" : "s"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {session.phase === "results" && (
        <Card>
          <SectionTitle>Results</SectionTitle>
          <ResultsSummary session={session} />
        </Card>
      )}

      <Card>
        <SectionTitle>Danger zone</SectionTitle>
        <button
          onClick={reset}
          className="px-4 py-2 bg-white border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition"
        >
          Reset session (clear teams & votes)
        </button>
      </Card>
    </>
  );
}

function ResultsSummary({ session }: { session: Session }) {
  const teams = Object.values(session.teams);
  const counts = getVoteTallies(session);
  const maxCount = Math.max(0, ...teams.map((t) => counts.get(t.id) ?? 0));
  const ranked = [...teams].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
  );

  return (
    <ol className="space-y-2">
      {ranked.map((team, i) => {
        const count = counts.get(team.id) ?? 0;
        const isWinner = count > 0 && count === maxCount;
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return (
          <li
            key={team.id}
            className={`rounded-lg border p-3 ${
              isWinner
                ? "border-amber-400 bg-amber-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-mono">
                  #{i + 1}
                </span>
                <span className="font-semibold text-slate-900">
                  {team.name}
                </span>
                {isWinner && (
                  <span className="text-xs px-2 py-0.5 bg-amber-500 text-white rounded">
                    winner
                  </span>
                )}
              </div>
              <span className="text-sm font-mono text-slate-700">
                {count} {count === 1 ? "vote" : "votes"}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isWinner ? "bg-amber-500" : "bg-slate-700"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
