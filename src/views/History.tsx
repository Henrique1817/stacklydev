import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import ResultCards from "../components/ResultCards";
import { toAnalysis } from "../lib/analysis";
import { getBillingStatus, type BillingStatus } from "../lib/billing";
import { ERROR_TYPE_LABELS, type ErrorType } from "../lib/detector";
import {
  deleteHistoryEntry,
  listHistory,
  listProjects,
  setAnalysisResolved,
  type HistoryEntry,
} from "../lib/history";
import { parsePartialJson } from "../lib/partialJson";
import { formatDateTime } from "../lib/signature";

export default function History({ onOpenUpgrade }: { onOpenUpgrade: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ErrorType | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (q = query, et = typeFilter, proj = projectFilter) => {
    setLoading(true);
    try {
      setError(null);
      const [rows, projs] = await Promise.all([
        listHistory({ query: q, errorType: et, project: proj }),
        listProjects(),
      ]);
      setEntries(rows);
      setProjects(projs);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getBillingStatus().then(setBilling).catch(() => { });
    const unlisten = listen<BillingStatus>("billing-changed", (e) => {
      setBilling(e.payload);
      load(query, typeFilter, projectFilter);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load(query, typeFilter, projectFilter);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, typeFilter, projectFilter]);

  const vote = async (entry: HistoryEntry, resolved: boolean) => {
    const next = entry.resolved === resolved ? null : resolved;
    try {
      const updated = await setAnalysisResolved(entry.id, next);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    } catch (e) {
      setError(String(e));
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteHistoryEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const parseEntry = (raw: string) => {
    try {
      return toAnalysis(JSON.parse(raw));
    } catch {
      return toAnalysis(parsePartialJson(raw));
    }
  };

  return (
    <div className="space-y-4">
      {billing && !billing.isPro && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
          <span>Free plan: showing only the last 7 days of history.</span>
          <button onClick={onOpenUpgrade} className="shrink-0 font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            Unlock full history
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search errors, titles, causes, or projects…"
          className="min-w-44 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
        />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ErrorType | "all")}
          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All types</option>
          {(Object.keys(ERROR_TYPE_LABELS) as ErrorType[]).map((t) => (
            <option key={t} value={t}>
              {ERROR_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <p className="py-10 text-center text-xs text-zinc-500">Loading history…</p>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-xs text-zinc-500">
          No analyses found in history.
        </p>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry) => {
            const parsed = parseEntry(entry.responseJson);
            const open = expandedId === entry.id;
            return (
              <article
                key={entry.id}
                className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <div
                  onClick={() => setExpandedId(open ? null : entry.id)}
                  className="flex cursor-pointer items-start justify-between gap-3 p-3.5 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                        {ERROR_TYPE_LABELS[entry.errorType] ?? entry.errorType}
                      </span>
                      {entry.project && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {entry.project}
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-400">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                    <h3 className="truncate text-sm font-semibold">
                      {parsed.titulo ?? entry.sanitizedError.split("\n")[0]}
                    </h3>
                    {parsed.causaProvavel && !open && (
                      <p className="line-clamp-2 text-xs text-zinc-500">{parsed.causaProvavel}</p>
                    )}
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Solved"
                      onClick={() => vote(entry, true)}
                      className={`rounded-md border px-2 py-1 text-xs transition ${entry.resolved === true
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50"
                          : "border-zinc-200 opacity-60 hover:opacity-100 dark:border-zinc-700"
                        }`}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      title="Didn't help"
                      onClick={() => vote(entry, false)}
                      className={`rounded-md border px-2 py-1 text-xs transition ${entry.resolved === false
                          ? "border-red-500 bg-red-50 dark:bg-red-950/50"
                          : "border-zinc-200 opacity-60 hover:opacity-100 dark:border-zinc-700"
                        }`}
                    >
                      👎
                    </button>
                    <button
                      type="button"
                      title="Delete from history"
                      onClick={() => remove(entry.id)}
                      className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="space-y-3 border-t border-zinc-100 p-3.5 dark:border-zinc-800">
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-zinc-500">
                        Saved sanitized error
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-zinc-100 p-2.5 font-mono text-[11.5px] whitespace-pre-wrap select-text dark:bg-zinc-900">
                        {entry.sanitizedError}
                      </pre>
                    </details>
                    <ResultCards
                      analysis={parsed}
                      streaming={false}
                      errorType={entry.errorType}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
