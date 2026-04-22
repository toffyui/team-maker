"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSessionId() {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [organizerCode, setOrganizerCode] = useState("");

  const startSession = () => {
    router.push(`/${generateSessionId()}`);
  };

  const joinSession = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code) router.push(`/${code}`);
  };

  const joinAsOrganizer = (e: React.FormEvent) => {
    e.preventDefault();
    const code = organizerCode.trim().toUpperCase();
    if (code) router.push(`/${code}?role=organizer`);
  };

  const startAsOrganizer = () => {
    router.push(`/${generateSessionId()}?role=organizer`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900">Team Maker</h1>
          <p className="mt-2 text-slate-600">
            Create teams and vote for the best one.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <button
            onClick={startSession}
            className="w-full py-3 px-4 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 active:bg-slate-950 transition"
          >
            Start new session
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs uppercase tracking-widest text-slate-500">
              or
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={joinSession} className="space-y-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="SESSION CODE"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 uppercase tracking-[0.3em] text-center font-mono"
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="w-full py-3 px-4 bg-white border border-slate-900 text-slate-900 font-semibold rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join session
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Join as organizer
            </h2>
            <p className="text-xs text-slate-500">
              Organizers don&apos;t join a team. They can manually assign people
              to teams and see voting progress.
            </p>
          </div>
          <button
            onClick={startAsOrganizer}
            className="w-full py-3 px-4 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition"
          >
            Start new session as organizer
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs uppercase tracking-widest text-slate-500">
              or
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={joinAsOrganizer} className="space-y-3">
            <input
              type="text"
              value={organizerCode}
              onChange={(e) => setOrganizerCode(e.target.value.toUpperCase())}
              placeholder="EXISTING SESSION CODE"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 uppercase tracking-[0.3em] text-center font-mono"
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={!organizerCode.trim()}
              className="w-full py-3 px-4 bg-white border border-amber-600 text-amber-700 font-semibold rounded-lg hover:bg-amber-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join existing session as organizer
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
