import type { ReactNode } from "react";
import type { Analysis } from "../lib/analysis";
import type { ErrorType } from "../lib/detector";
import { ERROR_TYPE_LABELS } from "../lib/detector";
import CodeBlock from "./CodeBlock";

const SNIPPET_LANG: Record<ErrorType, string> = {
  node: "typescript",
  nextjs: "tsx",
  python: "python",
  prisma: "prisma",
  docker: "dockerfile",
  postgres: "sql",
  "github-actions": "yaml",
  other: "code",
};

function Card({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        <span aria-hidden>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Skeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
          style={{ width: `${90 - i * 18}%` }}
        />
      ))}
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.75 ? "bg-emerald-500" : value >= 0.45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2" title="AI confidence in this diagnosis">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-500 tabular-nums">{pct}%</span>
    </div>
  );
}

interface Props {
  analysis: Analysis;
  streaming: boolean;
  errorType: ErrorType;
}

export default function ResultCards({ analysis, streaming, errorType }: Props) {
  const a = analysis;
  // Durante o streaming, mostra esqueleto para campos obrigatórios que ainda não chegaram.
  const pending = (present: boolean) => streaming && !present;

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
            {ERROR_TYPE_LABELS[errorType]}
          </span>
          {a.confianca !== undefined && <Confidence value={a.confianca} />}
        </div>
        {a.titulo ? (
          <h2 className="text-base leading-snug font-semibold select-text">{a.titulo}</h2>
        ) : (
          pending(false) && <Skeleton lines={1} />
        )}
      </section>

      {(a.causaProvavel || pending(!!a.causaProvavel)) && (
        <Card title="Probable cause" icon="🔎">
          {a.causaProvavel ? (
            <p className="text-sm leading-relaxed select-text">{a.causaProvavel}</p>
          ) : (
            <Skeleton />
          )}
        </Card>
      )}

      {(a.ondeOlhar?.length || pending(!!a.ondeOlhar?.length)) && (
        <Card title="Where to look" icon="📍">
          {a.ondeOlhar?.length ? (
            <ul className="space-y-1.5">
              {a.ondeOlhar.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm select-text">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <span className="break-words">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Skeleton />
          )}
        </Card>
      )}

      {(a.passosParaCorrigir?.length || pending(!!a.passosParaCorrigir?.length)) && (
        <Card title="Steps to fix" icon="🛠️">
          {a.passosParaCorrigir?.length ? (
            <ol className="space-y-2">
              {a.passosParaCorrigir.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm select-text">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed break-words">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Skeleton lines={3} />
          )}
        </Card>
      )}

      {a.comando && (
        <Card title="Command" icon="⌨️">
          <CodeBlock code={a.comando} label="shell" />
        </Card>
      )}

      {a.trechoDeCodigo && (
        <Card title="Code snippet" icon="🧩">
          <CodeBlock code={a.trechoDeCodigo} label={SNIPPET_LANG[errorType]} />
        </Card>
      )}
    </div>
  );
}

