"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session, Team } from "@/lib/types";
import { getOrCreateParticipantId, getSocket } from "@/lib/socket";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = (params?.sessionId ?? "").toUpperCase();

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
      socket.emit("session:join", {
        sessionId,
        participantId: pid,
        name: null,
      });
    };
    const onDisconnect = () => setConnected(false);

    socket.on("session:state", onState);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setConnected(true);
      socket.emit("session:join", {
        sessionId,
        participantId: pid,
        name: null,
      });
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
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (!sessionId) {
    return null;
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            ← Home
          </button>
          <div className="flex items-center gap-2">
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
            {!me && <NameEntry sessionId={sessionId} participantId={participantId} />}
            {me && session.phase === "lobby" && (
              <LobbyView session={session} me={me} />
            )}
            {me && session.phase === "voting" && (
              <VotingView
                session={session}
                me={me}
                participantId={participantId}
              />
            )}
            {me && session.phase === "results" && (
              <ResultsView session={session} me={me} />
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
}: {
  sessionId: string;
  participantId: string;
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
    });
  };

  return (
    <Card>
      <SectionTitle>Enter your name</SectionTitle>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          maxLength={50}
          autoFocus
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-5 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Join
        </button>
      </form>
    </Card>
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
  const participants = Object.values(session.participants);
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

function LobbyView({
  session,
  me,
}: {
  session: Session;
  me: { id: string; name: string };
}) {
  const [groupCount, setGroupCount] = useState("2");
  const total = Object.keys(session.participants).length;

  const canGenerate = () => {
    const n = Number(groupCount);
    return Number.isFinite(n) && n >= 1 && n <= 20 && total >= n;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate()) return;
    getSocket().emit("session:generateTeams", {
      sessionId: session.id,
      groupCount: Number(groupCount),
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
              Number of teams
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={groupCount}
              onChange={(e) => setGroupCount(e.target.value)}
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
        {total < Number(groupCount) && (
          <p className="mt-2 text-xs text-slate-500">
            Need at least {groupCount} attendees for {groupCount} teams.
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
  me: { id: string; name: string; teamId: string | null };
  participantId: string;
}) {
  const teams = Object.values(session.teams);
  const myVote = session.votes[participantId] ?? null;
  const votedIds = new Set(Object.keys(session.votes));
  const eligible = Object.values(session.participants).filter(
    (p) => p.teamId !== null,
  );
  const votedCount = eligible.filter((p) => session.votes[p.id]).length;

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

  const openResults = () => {
    if (!confirm("Open results now? Any un-submitted votes will be dropped.")) return;
    getSocket().emit("session:openResults", { sessionId: session.id });
  };

  return (
    <>
      <Card>
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <SectionTitle>Vote for the best team</SectionTitle>
          <span className="text-sm text-slate-500">
            {votedCount} / {eligible.length} voted
          </span>
        </div>
        {myTeam && (
          <p className="text-sm text-slate-600 mb-4">
            You are on{" "}
            <strong className="text-slate-900">{myTeam.name}</strong>. You
            cannot vote for your own team.
          </p>
        )}
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

        <div className="mt-4 flex justify-end">
          <button
            onClick={openResults}
            className="text-sm px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Open results now
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Attendees</SectionTitle>
        <AttendeesList session={session} meId={me.id} votedIds={votedIds} />
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

function ResultsView({
  session,
  me,
}: {
  session: Session;
  me: { id: string; name: string };
}) {
  const teams = Object.values(session.teams);
  const counts = new Map<string, number>();
  for (const teamId of Object.values(session.votes)) {
    counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  }
  const maxCount = Math.max(0, ...teams.map((t) => counts.get(t.id) ?? 0));
  const ranked = [...teams].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
  );

  const reset = () => {
    if (!confirm("Start a new round? Teams and votes will be cleared.")) return;
    getSocket().emit("session:reset", { sessionId: session.id });
  };

  return (
    <>
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
                <ul className="mt-2 text-xs text-slate-600">
                  {team.memberIds
                    .map((id) => session.participants[id]?.name)
                    .filter(Boolean)
                    .join(", ")}
                </ul>
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
    </>
  );
}
