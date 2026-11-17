import { isMac, shortcutLabel } from "../lib/tauri";

export default function Home() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg" />
      <h1 className="text-2xl font-bold tracking-tight">Bem-vindo ao Stackly</h1>
      <p className="max-w-xs text-sm text-zinc-500">
        O Stackly fica rodando {isMac ? "na barra de menu" : "na bandeja do sistema"}. Use o atalho
        abaixo para mostrar ou esconder esta janela de qualquer lugar.
      </p>
      <kbd className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        {shortcutLabel}
      </kbd>
    </div>
  );
}

