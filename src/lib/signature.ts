/**
 * Geração de "assinatura" normalizada do erro (sem caminhos, números, hashes e
 * timestamps) e utilitários de similaridade por trigramas.
 *
 * Sem dependências: pode ser testado diretamente com `node --test`.
 */

/** Normaliza um erro sanitizado para comparação entre ocorrências diferentes. */
export function buildSignature(sanitizedError: string): string {
  let s = sanitizedError.toLowerCase();

  // Timestamps ISO / horários comuns
  s = s.replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:z|[+-]\d{2}:?\d{2})?\b/g, " ");
  s = s.replace(/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g, " ");

  // Placeholders do sanitizador ([TOKEN_1], [IP_2], etc.) -> forma canônica sem índice
  s = s.replace(/\[([a-z_]+)_\d+\]/g, "<$1>");

  // Caminhos Windows (C:\dir\file.ts:10:5) e POSIX (/Users/a/b/file.py)
  s = s.replace(/[a-z]:\\(?:[^\s"'`():;<>|]+\\)*[^\s"'`():;<>|]*/gi, "<path>");
  s = s.replace(/(?:^|[\s("'`])(?:\.?\.?\/)+(?:[^\s"'`():;<>|]+\/)*[^\s"'`():;<>|]*/g, " <path>");

  // UUIDs e hashes hexadecimais (git shas, container ids, request ids)
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "<id>");
  s = s.replace(/\b[0-9a-f]{7,64}\b/g, "<hex>");

  // Números de linha/coluna e números isolados
  s = s.replace(/:\d+(?::\d+)?\b/g, "");
  s = s.replace(/\bline \d+\b/g, "line <n>");
  s = s.replace(/\b\d+\b/g, "<n>");

  // Normaliza pontuação repetida e espaços
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, 600);
}

function trigramSet(text: string): Set<string> {
  const set = new Set<string>();
  if (text.length < 3) return set;
  for (let i = 0; i <= text.length - 3; i++) {
    set.add(text.slice(i, i + 3));
  }
  return set;
}

/** Similaridade de Sørensen–Dice sobre trigramas (0 a 1). */
export function trigramSimilarity(a: string, b: string): number {
  if (a === b && a.length > 0) return 1;
  const ta = trigramSet(a);
  const tb = trigramSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const g of ta) {
    if (tb.has(g)) intersection++;
  }
  return (2 * intersection) / (ta.size + tb.size);
}

/** Formats timestamp (ms) as MM/DD (e.g., 11/03). */
export function formatShortDate(timestampMs: number): string {
  const d = new Date(timestampMs);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

/** Formats timestamp (ms) as YYYY-MM-DD HH:MM. */
export function formatDateTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

