import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import MaskReport from "../components/MaskReport";
import ResultCards from "../components/ResultCards";
import { analyzeError, cancelAnalysis, toAnalysis, type Analysis } from "../lib/analysis";
import { getBillingStatus, type BillingStatus } from "../lib/billing";
import { detectErrorType, ERROR_TYPE_LABELS, type ErrorType } from "../lib/detector";
import {
  findSimilarAnalyses,
  listProjects,
  saveAnalysis,
  setAnalysisResolved,
  type HistoryEntry,
  type SimilarMatch,
} from "../lib/history";
import { parsePartialJson } from "../lib/partialJson";
import { sanitize } from "../lib/sanitizer";
import { getSettings, hasApiKey, PROVIDERS, type AppSettings } from "../lib/settings";
import { buildSignature, formatShortDate } from "../lib/signature";
import { isMac, shortcutLabel } from "../lib/tauri";

type Status = "idle" | "streaming" | "done" | "error";

export default function Analyze({
  onOpenSettings,
  onOpenUpgrade,
}: {
  onOpenSettings: () => void;
  onOpenUpgrade: () => void;
}) {
  const [input, setInput] = useState("");
  const [override, setOverride] = useState<ErrorType | "auto">("auto");
  const [project, setProject] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<Analysis>({});
  const [savedEntry, setSavedEntry] = useState<HistoryEntry | null>(null);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [keyMissing, setKeyMissing] = useState(false);

  const [similar, setSimilar] = useState<SimilarMatch | null>(null);
  const [showSimilarDetails, setShowSimilarDetails] = useState(false);
  const [dismissedSimilarId, setDismissedSimilarId] = useState<number | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    getSettings()
      .then(async (s) => {
        setSettings(s);
        setKeyMissing(PROVIDERS[s.provider].needsKey && !(await hasApiKey(s.provider)));
      })
      .catch(() => {});
    getBillingStatus().then(setBilling).catch(() => {});
    listProjects().then(setProjects).catch(() => {});
    const unlisten = listen<BillingStatus>("billing-changed", (e) => setBilling(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const sanitized = useMemo(() => sanitize(input), [input]);
  const detection = useMemo(() => detectErrorType(input), [input]);
  const errorType: ErrorType = override === "auto" ? detection.type : override;
  const signature = useMemo(() => buildSignature(sanitized.text), [sanitized.text]);
  const canSubmit = input.trim().length > 0 && status !== "streaming";

  useEffect(() => {
    if (signature.length < 8) {
      setSimilar(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      findSimilarAnalyses(signature, errorType)
        .then((matches) => {
          if (cancelled) return;
          const top = matches[0] ?? null;
          setSimilar(top);
          setShowSimilarDetails(false);
          if (!top || top.entry.id !== dismissedSimilarId) {
            setDismissedSimilarId(null);
          }
        })
        .catch(() => {});
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signature, errorType]);

  const similarAnalysis = useMemo(() => {
    if (!similar) return null;
    try {
      return toAnalysis(JSON.parse(similar.entry.responseJson));
    } catch {
      return toAnalysis(parsePartialJson(similar.entry.responseJson));
    }
  }, [similar]);

  const run = async () => {
    if (!canSubmit) return;
    const id = ++runId.current;
    let buffer = "";
    setStatus("streaming");
    setAnalysis({});
    setSavedEntry(null);
    setRaw("");
    setError(null);

    const snapshotSanitized = sanitized.text;
    const snapshotSignature = signature;
    const snapshotType = errorType;
    const snapshotProject = project.trim() || null;

    try {
      await analyzeError(snapshotSanitized, snapshotType, detection.secondary, (chunk) => {
        if (id !== runId.current) return;
        buffer += chunk;
        setRaw(buffer);
        const partial = parsePartialJson(buffer);
        if (partial !== undefined) setAnalysis(toAnalysis(partial));
      });
      if (id !== runId.current) return;
      const parsed = parsePartialJson(buffer);
      const final = toAnalysis(parsed);
      setAnalysis(final);
      if (!final.titulo && !final.causaProvavel) {
        setError("The AI did not return the expected JSON format. See raw response below.");
        setStatus("error");
      } else {
        setStatus("done");
        const entry = await saveAnalysis({
          sanitizedError: snapshotSanitized,
          signature: snapshotSignature,
          errorType: snapshotType,
          project: snapshotProject,
          responseJson: JSON.stringify(final),
        }).catch(() => null);
        if (entry) {
          setSavedEntry(entry);
          if (snapshotProject && !projects.includes(snapshotProject)) {
            setProjects((prev) => [...prev, snapshotProject].sort());
          }
        }
        getBillingStatus().then(setBilling).catch(() => {});
      }
    } catch (e) {
      if (id !== runId.current) return;
      setError(String(e));
      setStatus("error");
    }
  };

  const cancel = async () => {
    runId.current++;
    setStatus(Object.keys(analysis).length ? "done" : "idle");
    await cancelAnalysis().catch(() => {});
  };

  const vote = async (resolved: boolean) => {
    if (!savedEntry) return;
    const next = savedEntry.resolved === resolved ? null : resolved;
    try {
      const updated = await setAnalysisResolved(savedEntry.id, next);
      setSavedEntry(updated);
    } catch {
      /* ignore */
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  };

  const providerLabel = settings ? PROVIDERS[settings.provider].label : "";
  const hasResult = status !== "idle" && (Object.values(analysis).some((v) => v !== undefined) || status === "streaming");
  const showSimilarBanner =
    similar &&
    similarAnalysis &&
    similar.entry.id !== dismissedSimilarId &&
    status === "idle";
  const limitReached = !!billing && !billing.isPro && billing.todayUsed >= billing.dailyLimit;

  return (
    <div className="space-y-4">
      {limitReached && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
          <span>
            You reached today&apos;s Free limit ({billing.dailyLimit} analyses).
          </span>
          <button onClick={onOpenUpgrade} className="shrink-0 font-semibold underline">
            Upgrade to Pro
          </button>
        </div>
      )}

      {keyMissing && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Add your {providerLabel} API key to analyze errors.</span>
          <button onClick={onOpenSettings} className="shrink-0 font-medium underline">
            Configure
          </button>
        </div>
      )}

      {showSimilarBanner && (
        <section className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <span>
                  {similar.entry.resolved
                    ? `You already solved this error on ${formatShortDate(similar.entry.createdAt)} — here is how:`
                    : `Similar error analyzed on ${formatShortDate(similar.entry.createdAt)}:`}
                </span>
                <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                  {Math.round(similar.similarity * 100)}% match
                </span>
                {similar.entry.project && (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {similar.entry.project}
                  </span>
                )}
              </div>
              {similarAnalysis.titulo && (
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {similarAnalysis.titulo}
                </div>
              )}
              {!showSimilarDetails && similarAnalysis.causaProvavel && (
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {similarAnalysis.causaProvavel}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissedSimilarId(similar.entry.id)}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              title="Dismiss suggestion"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSimilarDetails((v) => !v)}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-500"
            >
              {showSimilarDetails ? "Collapse solution" : "View full solution"}
            </button>
            <button
              type="button"
              onClick={run}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100/60 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
            >
              Run AI anyway
            </button>
          </div>

          {showSimilarDetails && (
            <div className="pt-1">
              <ResultCards
                analysis={similarAnalysis}
                streaming={false}
                errorType={similar.entry.errorType}
              />
            </div>
          )}
        </section>
      )}

      <div>
        <textarea
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder="Paste your error, stack trace, or CI log here…"
          className="h-44 w-full resize-y rounded-xl border border-zinc-300 bg-white p-3 font-mono text-[12.5px] leading-relaxed outline-none select-text placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950/60"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>Type:</span>
            <select
              value={override}
              onChange={(e) => setOverride(e.target.value as ErrorType | "auto")}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="auto">
                Auto{input.trim() ? ` — ${ERROR_TYPE_LABELS[detection.type]}` : ""}
              </option>
              {(Object.keys(ERROR_TYPE_LABELS) as ErrorType[]).map((t) => (
                <option key={t} value={t}>
                  {ERROR_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            <input
              type="text"
              list="stackly-projects"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Project (optional)"
              className="w-36 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <datalist id="stackly-projects">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          {status === "streaming" ? (
            <button
              onClick={cancel}
              className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!canSubmit}
              title={`${isMac ? "⌘" : "Ctrl"} + Enter`}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Analyze{providerLabel && ` with ${providerLabel}`}
            </button>
          )}
        </div>
      </div>

      {input.trim() && <MaskReport result={sanitized} />}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 select-text dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {hasResult && <ResultCards analysis={analysis} streaming={status === "streaming"} errorType={errorType} />}

      {savedEntry && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
          <span className="text-zinc-600 dark:text-zinc-400">Did this answer solve your issue?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => vote(true)}
              className={`rounded-lg border px-2.5 py-1 transition ${
                savedEntry.resolved === true
                  ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              👍 Solved
            </button>
            <button
              type="button"
              onClick={() => vote(false)}
              className={`rounded-lg border px-2.5 py-1 transition ${
                savedEntry.resolved === false
                  ? "border-red-500 bg-red-50 font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              👎 Didn&apos;t help
            </button>
          </div>
        </div>
      )}

      {status === "error" && raw && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">Raw response</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-100 p-3 whitespace-pre-wrap select-text dark:bg-zinc-950">
            {raw}
          </pre>
        </details>
      )}

      {!input.trim() && status === "idle" && (
        <p className="pt-6 text-center text-xs text-zinc-400">
          {billing && !billing.isPro ? (
            <>
              Free plan: {billing.todayUsed}/{billing.dailyLimit} analyses today ·{" "}
              <button onClick={onOpenUpgrade} className="text-indigo-500 hover:underline">
                Unlock unlimited analyses, bug memory & global shortcut with Pro
              </button>
            </>
          ) : (
            <>
              Tip: press <kbd className="font-mono">{shortcutLabel}</kbd> to toggle Stackly from anywhere.
              Secrets are masked locally before sending.
            </>
          )}
        </p>
      )}
    </div>
  );
}
