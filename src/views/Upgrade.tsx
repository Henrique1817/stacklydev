import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  activateLicense,
  deactivateLicense,
  formatTimeSaved,
  getBillingStatus,
  openCheckout,
  revalidateLicense,
  type BillingStatus,
} from "../lib/billing";
import { formatDateTime } from "../lib/signature";
import { shortcutLabel } from "../lib/tauri";

export default function Upgrade() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBillingStatus().then(setStatus).catch((e) => setError(String(e)));
    const unlisten = listen<BillingStatus>("billing-changed", (e) => setStatus(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleCheckout = async () => {
    try {
      setError(null);
      await openCheckout();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setBusy(true);
    try {
      setError(null);
      setNotice(null);
      const next = await activateLicense(licenseKey.trim());
      setStatus(next);
      setLicenseKey("");
      setNotice("License activated! Pro features unlocked.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRevalidate = async () => {
    setBusy(true);
    try {
      setError(null);
      setNotice(null);
      const next = await revalidateLicense();
      setStatus(next);
      setNotice("License revalidated with Stripe.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async () => {
    setBusy(true);
    try {
      setError(null);
      setNotice(null);
      const next = await deactivateLicense();
      setStatus(next);
      setNotice("License removed from this device.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const isPro = status?.isPro ?? false;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plan & Usage</h2>
          <p className="text-xs text-zinc-500">
            Secure global checkout via Stripe, with 7-day offline license cache.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isPro
              ? "bg-indigo-600 text-white"
              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {isPro ? "Stackly Pro" : "Free Plan"}
        </span>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[11px] text-zinc-500">Analyses run</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {status ? status.totalAnalyses : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[11px] text-zinc-500">Est. time saved*</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600 tabular-nums dark:text-indigo-400">
            {status ? formatTimeSaved(status.estimatedMinutesSaved) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[11px] text-zinc-500">Used today</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {status
              ? isPro
                ? `${status.todayUsed} / ∞`
                : `${status.todayUsed} / ${status.dailyLimit}`
              : "—"}
          </div>
        </div>
      </section>
      <p className="-mt-3 text-[11px] text-zinc-400">
        *Conservative estimate of 10 minutes saved per analysis.
      </p>

      <section className="grid grid-cols-2 gap-3">
        <div
          className={`rounded-xl border p-4 ${
            !isPro
              ? "border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-950/60"
              : "border-zinc-200 bg-white/60 opacity-75 dark:border-zinc-800 dark:bg-zinc-950/30"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Free</h3>
            <span className="text-sm font-bold">$0</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <li>• 5 analyses per day</li>
            <li>• Last 7 days of history</li>
            <li>• Local sanitizer + your own API key</li>
          </ul>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            isPro
              ? "border-indigo-500 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30"
              : "border-indigo-300 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Pro</h3>
            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
              $2.99<span className="text-[11px] font-normal">/mo</span>
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <li>✓ Unlimited analyses</li>
            <li>✓ Full searchable history</li>
            <li>✓ Bug memory (similar errors)</li>
            <li>✓ Global shortcut ({shortcutLabel})</li>
          </ul>
          {!isPro && (
            <button
              type="button"
              onClick={handleCheckout}
              className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Upgrade to Pro — $2.99/mo
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        {isPro ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  ✓ Pro license active
                </div>
                {status?.customerEmail && (
                  <div className="text-xs text-zinc-500">{status.customerEmail}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRevalidate}
                  className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Revalidate
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDeactivate}
                  className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Deactivate
                </button>
              </div>
            </div>
            {status?.offlineValidUntil && (
              <p className="text-[11px] text-zinc-500">
                Offline cache valid until {formatDateTime(status.offlineValidUntil)}.
              </p>
            )}
          </>
        ) : (
          <>
            <div>
              <div className="text-sm font-medium">Already subscribed on Stripe?</div>
              <div className="text-xs text-zinc-500">
                Paste your subscription ID (<code className="font-mono">sub_...</code>) or the email used at checkout.
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                placeholder="sub_... or you@email.com"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                disabled={busy || !licenseKey.trim()}
                onClick={handleActivate}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
              >
                {busy ? "Validating…" : "Activate license"}
              </button>
            </div>
          </>
        )}
      </section>

      {notice && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
