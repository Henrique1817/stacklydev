import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getBillingStatus, type BillingStatus } from "./lib/billing";
import Analyze from "./views/Analyze";
import History from "./views/History";
import Settings from "./views/Settings";
import Upgrade from "./views/Upgrade";

type View = "home" | "history" | "upgrade" | "settings";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  // O backend emite "navigate" quando o usuário escolhe "Configurações" na bandeja.
  useEffect(() => {
    getBillingStatus().then(setBilling).catch(() => { });
    const unlistenNav = listen<View>("navigate", (e) => setView(e.payload));
    const unlistenBill = listen<BillingStatus>("billing-changed", (e) => setBilling(e.payload));
    return () => {
      unlistenNav.then((fn) => fn());
      unlistenBill.then((fn) => fn());
    };
  }, []);

  const tabs: { id: View; label: string }[] = [
    { id: "home", label: "Analyze" },
    { id: "history", label: "History" },
    { id: "upgrade", label: billing?.isPro ? "Pro Plan" : "Upgrade" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600" />
          <span className="font-semibold tracking-tight">Stackly</span>
          {billing?.isPro && (
            <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              PRO
            </span>
          )}
        </div>
        <nav className="flex gap-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`rounded-md px-2.5 py-1.5 transition ${view === t.id
                  ? "bg-zinc-200 font-medium dark:bg-zinc-800"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-auto p-5">
        {view === "home" && (
          <Analyze
            onOpenSettings={() => setView("settings")}
            onOpenUpgrade={() => setView("upgrade")}
          />
        )}
        {view === "history" && <History onOpenUpgrade={() => setView("upgrade")} />}
        {view === "upgrade" && <Upgrade />}
        {view === "settings" && <Settings />}
      </main>
    </div>
  );
}
