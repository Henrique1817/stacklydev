import { useState } from "react";

export default function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* área de transferência indisponível */
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-zinc-400 uppercase">{label}</span>
        <button
          onClick={copy}
          className="rounded px-2 py-0.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12.5px] leading-relaxed select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

