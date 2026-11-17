import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  deleteApiKey,
  getSettings,
  hasApiKey,
  PROVIDERS,
  saveSettings,
  setApiKey,
  type AppSettings,
  type Language,
  type Provider,
} from "../lib/settings";
import { autostartLabel, getAutostart, setAutostart, shortcutLabel } from "../lib/tauri";

const PROVIDER_ORDER: Provider[] = ["openai", "anthropic", "ollama"];

export default function Settings() {
  const [autostart, setAutostartState] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [hasKey, setHasKey] = useState<Record<Provider, boolean>>({
    openai: false,
    anthropic: false,
    ollama: true,
  });
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAutostart().then(setAutostartState).catch((e) => setError(String(e)));
    getSettings().then(setSettings).catch((e) => setError(String(e)));
    Promise.all([hasApiKey("openai"), hasApiKey("anthropic")])
      .then(([openai, anthropic]) => setHasKey({ openai, anthropic, ollama: true }))
      .catch(() => {});

    const unlisten = listen<boolean>("autostart-changed", (e) => setAutostartState(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const flash = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice((cur) => (cur === msg ? null : cur)), 2000);
  };

  const updateSettings = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      setError(null);
      const persisted = await saveSettings(next);
      setSettings(persisted);
      flash("Settings saved");
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleAutostart = async () => {
    if (autostart === null) return;
    try {
      setError(null);
      setAutostartState(await setAutostart(!autostart));
    } catch (e) {
      setError(String(e));
    }
  };

  const saveKey = async () => {
    if (!settings || !keyInput.trim()) return;
    const provider = settings.provider;
    setKeyBusy(true);
    try {
      setError(null);
      await setApiKey(provider, keyInput.trim());
      setKeyInput("");
      setHasKey((prev) => ({ ...prev, [provider]: true }));
      flash(`${PROVIDERS[provider].label} API key saved to system keychain`);
    } catch (e) {
      setError(String(e));
    } finally {
      setKeyBusy(false);
    }
  };

  const removeKey = async () => {
    if (!settings) return;
    const provider = settings.provider;
    setKeyBusy(true);
    try {
      setError(null);
      await deleteApiKey(provider);
      setHasKey((prev) => ({ ...prev, [provider]: false }));
      flash(`${PROVIDERS[provider].label} API key removed`);
    } catch (e) {
      setError(String(e));
    } finally {
      setKeyBusy(false);
    }
  };

  const provider = settings?.provider ?? "openai";
  const providerMeta = PROVIDERS[provider];
  const modelField = providerMeta.modelField;
  const modelValue = settings ? (settings[modelField] as string) : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Settings</h2>
        {savedNotice && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ✓ {savedNotice}
          </span>
        )}
      </div>

      {/* AI Provider & Keychain */}
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div>
          <div className="text-sm font-medium">AI Provider</div>
          <div className="text-xs text-zinc-500">
            Choose which model analyzes sanitized logs.
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {PROVIDER_ORDER.map((p) => {
              const active = provider === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={!settings}
                  onClick={() => {
                    setKeyInput("");
                    updateSettings({ provider: p });
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                      : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div>{PROVIDERS[p].label}</div>
                  {PROVIDERS[p].needsKey ? (
                    <div className="mt-0.5 text-[10px] font-normal text-zinc-500">
                      {hasKey[p] ? "● Key saved" : "○ No key"}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] font-normal text-zinc-500">No key needed</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Model ({providerMeta.label})
          </label>
          <input
            type="text"
            disabled={!settings}
            value={modelValue}
            onChange={(e) => settings && setSettings({ ...settings, [modelField]: e.target.value })}
            onBlur={() => settings && updateSettings({ [modelField]: settings[modelField] })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {provider === "ollama" ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Ollama URL
            </label>
            <input
              type="url"
              disabled={!settings}
              value={settings?.ollamaUrl ?? ""}
              onChange={(e) => settings && setSettings({ ...settings, ollamaUrl: e.target.value })}
              onBlur={() => settings && updateSettings({ ollamaUrl: settings.ollamaUrl })}
              placeholder="http://localhost:11434"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        ) : (
          <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                API key ({providerMeta.label})
              </span>
              <span
                className={`text-[11px] font-medium ${
                  hasKey[provider] ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {hasKey[provider] ? "Stored in system keychain" : "Not configured"}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveKey()}
                placeholder={
                  hasKey[provider]
                    ? "Paste a new key to replace…"
                    : `Paste your key (${providerMeta.keyHint})`
                }
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                disabled={keyBusy || !keyInput.trim()}
                onClick={saveKey}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
              >
                Save
              </button>
              {hasKey[provider] && (
                <button
                  type="button"
                  disabled={keyBusy}
                  onClick={removeKey}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              Stored in macOS Keychain or Windows Credential Manager — never saved in plain text.
            </p>
          </div>
        )}
      </section>

      {/* Response language */}
      <section className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Analysis language</div>
            <div className="text-xs text-zinc-500">Language used by the AI in responses.</div>
          </div>
          <select
            disabled={!settings}
            value={settings?.language ?? "en"}
            onChange={(e) => updateSettings({ language: e.target.value as Language })}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="en">English (en)</option>
            <option value="pt-BR">Português (pt-BR)</option>
          </select>
        </div>
      </section>

      {/* System */}
      <section className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/40">
        <label className="flex cursor-pointer items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium">{autostartLabel}</div>
            <div className="text-xs text-zinc-500">Starts Stackly minimized to the tray at login.</div>
          </div>
          <button
            role="switch"
            aria-checked={!!autostart}
            disabled={autostart === null}
            onClick={toggleAutostart}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              autostart ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                autostart ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>

        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium">Global shortcut</div>
            <div className="text-xs text-zinc-500">Shows or hides the Stackly window (Pro).</div>
          </div>
          <kbd className="rounded-md border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-700">
            {shortcutLabel}
          </kbd>
        </div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
