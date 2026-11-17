/**
 * Detecta o tipo de erro por sinais ponderados (regex). O tipo principal e os
 * secundários vão para o prompt de sistema da IA.
 *
 * Sem imports: pode ser testado diretamente com `node --test`.
 */

export type ErrorType =
  | "node"
  | "python"
  | "prisma"
  | "docker"
  | "postgres"
  | "nextjs"
  | "github-actions"
  | "other";

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  node: "Node.js / TypeScript",
  python: "Python",
  prisma: "Prisma",
  docker: "Docker",
  postgres: "PostgreSQL",
  nextjs: "Next.js",
  "github-actions": "GitHub Actions (CI)",
  other: "Other",
};

export interface Detection {
  type: ErrorType;
  /** 0–1, relativo à força dos sinais encontrados. */
  confidence: number;
  /** Outros tipos com sinais relevantes (ex.: erro de Prisma dentro de um job de CI). */
  secondary: ErrorType[];
  /** Descrição dos sinais que levaram à detecção. */
  signals: string[];
}

type Signal = [pattern: RegExp, weight: number, description: string];

const SIGNALS: Record<Exclude<ErrorType, "other">, Signal[]> = {
  "github-actions": [
    [/##\[(?:error|group|endgroup)\]/, 5, "marcador ##[error]"],
    [/\.github\/workflows\//, 4, "caminho .github/workflows"],
    [/Process completed with exit code \d+/, 4, "“Process completed with exit code”"],
    [/\bRun actions\/|\buses:\s*actions\//, 3, "uso de actions/*"],
    [/\bGITHUB_(?:WORKSPACE|ACTIONS|RUN_ID|REF|SHA|OUTPUT|ENV)\b/, 2, "variáveis GITHUB_*"],
    [/\bruns-on:/, 2, "runs-on:"],
    [/Error: Unable to resolve action/, 4, "action não encontrada"],
  ],
  prisma: [
    [/@prisma\/client|prisma-client-js/, 4, "@prisma/client"],
    [/\bPrisma(?:Client)?(?:Known|Unknown|Validation|Initialization|RustPanic)?(?:Request)?Error\b/, 5, "classe PrismaClient*Error"],
    [/\bP[1-3]\d{3}\b/, 3, "código de erro Pxxxx"],
    [/\bschema\.prisma\b/, 4, "schema.prisma"],
    [/\bprisma (?:migrate|generate|db (?:push|pull|seed)|studio)\b/, 3, "comando prisma"],
    [/Invalid `(?:prisma|db)\.\w+\.\w+\(\)` invocation/, 5, "invocação inválida do Prisma"],
  ],
  nextjs: [
    [/\bnext\/dist\//, 4, "next/dist no stack"],
    [/\bNext\.js\b/, 3, "menção a Next.js"],
    [/\bnext (?:dev|build|start|lint)\b/, 3, "comando next"],
    [/\b(?:getServerSideProps|getStaticProps|getStaticPaths|generateStaticParams|generateMetadata)\b/, 3, "API de data fetching do Next"],
    [/Hydration failed|Text content does not match server-rendered HTML|hydration mismatch/i, 4, "erro de hidratação"],
    [/\.next\/(?:server|static)|\(rsc\)|react-server-dom/, 3, "build .next / RSC"],
    [/["']use client["']|\buse client\b|Server Component|Client Component/, 3, "Server/Client Components"],
    [/\bnext\.config\.(?:js|mjs|ts)\b/, 3, "next.config"],
    [/\bNEXT_PUBLIC_\w+/, 1, "NEXT_PUBLIC_*"],
  ],
  docker: [
    [/\bDockerfile\b/, 3, "Dockerfile"],
    [/\bdocker(?:-compose| compose| build| run| push| pull)\b/, 3, "comando docker"],
    [/failed to solve|failed to compute cache key/, 5, "erro do BuildKit"],
    [/=> ERROR \[|ERROR \[[\w-]+ \d+\/\d+\]/, 4, "passo de build com ERROR"],
    [/Cannot connect to the Docker daemon/, 5, "daemon Docker indisponível"],
    [/pull access denied|manifest unknown|no matching manifest/, 4, "erro de imagem/registry"],
    [/\bOCI runtime\b|exec format error/, 4, "erro de runtime OCI"],
    [/\bcontainer [\w-]+ (?:exited|is unhealthy|is not running)/i, 3, "container parado"],
    [/\bdocker-compose\.ya?ml\b|\bcompose\.ya?ml\b/, 3, "arquivo compose"],
  ],
  postgres: [
    [/\bSQLSTATE\b/, 4, "SQLSTATE"],
    [/\bPostgreSQL\b|\bpostgres(?:ql)?:\/\//i, 3, "PostgreSQL"],
    [/\bpsql\b|\bpg_dump\b|\bpg_restore\b/, 3, "ferramenta psql/pg_*"],
    [/ERROR:\s+(?:relation|column) "[^"]+" (?:does not exist|already exists)/, 5, "relation/column inexistente"],
    [/duplicate key value violates unique constraint|violates foreign key constraint/, 4, "violação de constraint"],
    [/syntax error at or near/, 4, "erro de sintaxe SQL"],
    [/FATAL:\s+(?:password authentication failed|database "[^"]+" does not exist|role "[^"]+" does not exist|no pg_hba\.conf entry)/, 5, "FATAL de autenticação/banco"],
    [/:5432\b/, 2, "porta 5432"],
    [/\b(?:23505|23503|42P01|42703|42601|28P01|3D000|53300)\b/, 3, "código SQLSTATE conhecido"],
  ],
  python: [
    [/Traceback \(most recent call last\)/, 6, "Traceback do Python"],
    [/File "[^"]+\.py", line \d+/, 5, "frame de arquivo .py"],
    [/\b(?:ModuleNotFoundError|ImportError|IndentationError|KeyError|AttributeError|NameError|ZeroDivisionError|StopIteration)\b/, 3, "exceção típica do Python"],
    [/\b(?:pip install|requirements\.txt|site-packages|venv|pyproject\.toml|poetry|uvicorn|django|flask)\b/i, 2, "ecossistema Python"],
  ],
  node: [
    [/\berror TS\d{4}\b/, 5, "erro do compilador TypeScript"],
    [/\bat (?:async )?[\w.<>$]+ \((?:file:\/\/)?[^)]+\.(?:[cm]?js|tsx?):\d+:\d+\)/, 4, "stack trace JS/TS"],
    [/\bnode:internal\//, 4, "node:internal"],
    [/\bnpm (?:ERR!|error)|\bpnpm\b.*ERR_|\byarn (?:run|install).*error/i, 3, "erro de npm/pnpm/yarn"],
    [/Cannot find module '[^']+'/, 4, "Cannot find module"],
    [/\bERR_[A-Z_]{4,}\b/, 3, "código ERR_* do Node"],
    [/\bnode_modules\//, 2, "node_modules"],
    [/UnhandledPromiseRejection|ReferenceError|SyntaxError: (?:Unexpected token|Cannot use import)/, 3, "erro de runtime JS"],
    [/\btsconfig\.json\b|\bpackage\.json\b/, 2, "tsconfig/package.json"],
    [/\bTypeError: (?:Cannot read propert|.* is not a function|.* is not iterable)/, 3, "TypeError de JS"],
  ],
};

/** Desempate: tipos mais específicos vencem os genéricos. */
const PRIORITY: ErrorType[] = ["github-actions", "prisma", "nextjs", "docker", "postgres", "python", "node"];

const MIN_SCORE = 3;

export function detectErrorType(text: string): Detection {
  const scores = new Map<ErrorType, { score: number; signals: string[] }>();

  for (const type of PRIORITY) {
    const signals = SIGNALS[type as Exclude<ErrorType, "other">];
    let score = 0;
    const found: string[] = [];
    for (const [pattern, weight, description] of signals) {
      if (pattern.test(text)) {
        score += weight;
        found.push(description);
      }
    }
    scores.set(type, { score, signals: found });
  }

  const ranked = PRIORITY.map((type) => ({ type, ...scores.get(type)! }))
    .filter((r) => r.score >= MIN_SCORE)
    // Ordena por pontuação; empates mantêm a ordem de PRIORITY (sort é estável).
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { type: "other", confidence: 0, secondary: [], signals: [] };
  }

  // Frameworks/ferramentas específicas vencem o genérico quando têm sinal forte:
  // ex. um log de CI contendo stack trace de Node continua sendo "github-actions".
  let primary = ranked[0];
  for (const candidate of ranked) {
    if (PRIORITY.indexOf(candidate.type) < PRIORITY.indexOf(primary.type) && candidate.score >= 6) {
      primary = candidate;
    }
  }

  const confidence = Math.min(1, primary.score / 12);
  const secondary = ranked.filter((r) => r.type !== primary.type).map((r) => r.type);
  return { type: primary.type, confidence, secondary, signals: primary.signals };
}

