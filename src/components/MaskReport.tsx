import { useState } from "react";
import type { SanitizeResult } from "../lib/sanitizer";
import { MASK_KINDS, splitPlaceholders } from "../lib/sanitizer";

/** Mostra ao usuário o que foi mascarado e o texto exato que será enviado. */
export default function MaskReport({ result }: { result: SanitizeResult }) {
  const [showText, setShowText] = useState(false);
  const total = result.items.reduce((n, item) => n + item.occurrences, 0);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span aria-hidden>{total ? "🛡️" : "✅"}</span>
          <span className="font-medium">
            {total
              ? `${total} ${total === 1 ? "item masked" : "items masked"} before sending`
              : "No sensitive data found"}
          </span>
        </div>
        <button
          onClick={() => setShowText((v) => !v)}
          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {showText ? "Hide sent text" : "Preview sent text"}
        </button>
      </div>

      {result.items.length > 0 && (
        <ul className="max-h-40 divide-y divide-zinc-100 overflow-auto border-t border-zinc-100 dark:divide-zinc-800/70 dark:border-zinc-800">
          {result.items.map((item) => (
            <li key={item.placeholder} className="flex items-center justify-between gap-3 px-4 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <code className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {item.placeholder}
                </code>
                <span className="truncate text-xs text-zinc-500">{MASK_KINDS[item.kind].label}</span>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-zinc-400" title="Local preview — never sent">
                {item.preview}
                {item.occurrences > 1 && ` ×${item.occurrences}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showText && (
        <pre className="max-h-56 overflow-auto border-t border-zinc-100 px-4 py-3 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap select-text dark:border-zinc-800">
          {splitPlaceholders(result.text).map((part, i) =>
            part.placeholder ? (
              <mark key={i} className="rounded bg-amber-200 px-0.5 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </pre>
      )}
    </section>
  );
}

