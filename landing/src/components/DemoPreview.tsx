"use client";

import { useEffect, useState } from "react";

const PHASES = [
  { id: 0, label: "Global shortcut", time: "0.0s" },
  { id: 1, label: "Local sanitizer", time: "0.2s" },
  { id: 2, label: "Streaming diagnosis", time: "1.4s" },
  { id: 3, label: "Ready to fix", time: "2.8s" },
];

export default function DemoPreview() {
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const durations = [1400, 1400, 1400, 3200];
    const timer = setTimeout(() => {
      setPhase((p) => (p + 1) % 4);
    }, durations[phase]);
    return () => clearTimeout(timer);
  }, [phase, paused]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="ml-2 text-xs font-semibold text-zinc-200">Stackly</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            Ctrl+Shift+E / ⌘⇧E
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-emerald-400">
            {PHASES[phase].time}
          </span>
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-zinc-800 bg-zinc-950/60 text-[11px]">
        {PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPhase(p.id)}
            className={`px-2 py-2 text-left transition ${phase === p.id
                ? "border-b-2 border-indigo-500 bg-zinc-900 font-medium text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4 text-left">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300">
          {phase === 0 ? (
            <div className="flex items-center justify-between text-zinc-400">
              <span>Window summoned instantly via global shortcut…</span>
              <kbd className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200">
                ⌘ ⇧ E
              </kbd>
            </div>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap">
              <span className="text-red-400">PrismaClientKnownRequestError:</span>{" "}
              Invalid `prisma.user.findUnique()` invocation:{"\n"}
              The table `public.User` does not exist in the current database.{"\n"}
              <span className="text-zinc-500">DATABASE_URL=postgres://</span>
              <mark className="rounded bg-amber-900/60 px-1 text-amber-200">
                [URL_CREDENTIALS_1]
              </mark>
              <span className="text-zinc-500">@db.internal:5432/prod</span>
            </pre>
          )}
        </div>

        {phase >= 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs">
            <span className="text-zinc-300">
              🛡️ <strong className="font-medium text-zinc-100">1 credential masked</strong>{" "}
              before sending
            </span>
            <span className="rounded-full bg-indigo-950 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
              Detected: Prisma · P2021
            </span>
          </div>
        )}

        {phase >= 2 && (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <div className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                🔎 Probable cause
              </div>
              <p className="text-xs leading-relaxed text-zinc-200">
                Your Prisma schema defines the <code className="text-indigo-300">User</code> model,
                but pending migrations have not been applied to the database referenced by{" "}
                <code className="text-amber-300">DATABASE_URL</code>.
              </p>
            </div>

            {phase >= 3 && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                  <div className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                    📍 Where to look
                  </div>
                  <ul className="space-y-1 text-xs text-zinc-300">
                    <li>• prisma/schema.prisma (model User)</li>
                    <li>• prisma/migrations/ directory</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                  <div className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                    ⌨️ Suggested command
                  </div>
                  <code className="block rounded bg-zinc-900 px-2 py-1.5 font-mono text-[11px] text-emerald-300">
                    npx prisma migrate deploy
                  </code>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
