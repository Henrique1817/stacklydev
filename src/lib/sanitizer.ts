/**
 * Sanitizador local: mascara segredos e dados pessoais ANTES de qualquer envio à IA.
 *
 * Estratégia em camadas (das regras mais específicas para as mais genéricas):
 *  1. Chaves privadas PEM            6. Linhas de .env (KEY=valor)
 *  2. Credenciais em URLs            7. Pares chave/valor sensíveis (password: ..., "token": "...")
 *  3. JWT                            8. E-mails
 *  4. Tokens com prefixo conhecido   9. IPs (v4 e v6; loopback é mantido)
 *  5. Authorization: Bearer/Basic   10. Strings de alta entropia (Shannon)
 *
 * O mesmo valor sempre recebe o mesmo placeholder (ex.: [EMAIL_1]), preservando
 * a correlação no log sem expor o conteúdo.
 *
 * Sem dependências e sem imports: pode ser testado diretamente com `node --test`.
 */

export type MaskKind =
  | "private_key"
  | "url_credentials"
  | "jwt"
  | "token"
  | "auth_header"
  | "secret"
  | "env_value"
  | "email"
  | "ip"
  | "high_entropy";

export interface MaskedItem {
  kind: MaskKind;
  placeholder: string;
  /** Prévia parcial do valor original (apenas exibida localmente). */
  preview: string;
  occurrences: number;
}

export interface SanitizeResult {
  text: string;
  items: MaskedItem[];
}

export const MASK_KINDS: Record<MaskKind, { tag: string; label: string }> = {
  private_key: { tag: "PRIVATE_KEY", label: "Private key" },
  url_credentials: { tag: "URL_CREDENTIALS", label: "URL credentials" },
  jwt: { tag: "JWT", label: "JWT token" },
  token: { tag: "TOKEN", label: "API token" },
  auth_header: { tag: "AUTH", label: "Authorization header" },
  secret: { tag: "SECRET", label: "Password / secret" },
  env_value: { tag: "ENV_VALUE", label: ".env value" },
  email: { tag: "EMAIL", label: "Email" },
  ip: { tag: "IP", label: "IP address" },
  high_entropy: { tag: "HIGH_ENTROPY", label: "High-entropy string" },
};

export const PLACEHOLDER_RE = /\[[A-Z_]+_\d+\]/g;
const FULL_PLACEHOLDER_RE = /^\[[A-Z_]+_\d+\]$/;

// ---------------------------------------------------------------------------
// Utilitários

/** Entropia de Shannon em bits por caractere. */
export function shannonEntropy(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function previewOf(value: string): string {
  const v = value.replace(/\s+/g, " ").trim();
  if (v.length <= 8) return "•".repeat(Math.max(v.length, 3));
  return `${v.slice(0, 3)}•••${v.slice(-2)} (${v.length} chars)`;
}

function createMasker() {
  const byValue = new Map<string, MaskedItem>();
  const counters = new Map<string, number>();
  const items: MaskedItem[] = [];

  const mask = (kind: MaskKind, value: string): string => {
    const existing = byValue.get(value);
    if (existing) {
      existing.occurrences++;
      return existing.placeholder;
    }
    const tag = MASK_KINDS[kind].tag;
    const n = (counters.get(tag) ?? 0) + 1;
    counters.set(tag, n);
    const item: MaskedItem = { kind, placeholder: `[${tag}_${n}]`, preview: previewOf(value), occurrences: 1 };
    byValue.set(value, item);
    items.push(item);
    return item.placeholder;
  };

  return { mask, items };
}

type Mask = (kind: MaskKind, value: string) => string;

// ---------------------------------------------------------------------------
// Regras

const PRIVATE_KEY_RE =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g;

// scheme://userinfo@host — userinfo com ":" (user:senha) ou longo (token como usuário).
const URL_USERINFO_RE = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@'"`<>]+)@(?=[^\s@])/gi;

const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

const KNOWN_TOKEN_RE = new RegExp(
  [
    String.raw`\bsk-(?:proj-|ant-(?:api\d{2}-)?|svcacct-)?[A-Za-z0-9_-]{20,}`, // OpenAI / Anthropic
    String.raw`\bgh[pousr]_[A-Za-z0-9]{30,}`, // GitHub
    String.raw`\bgithub_pat_[A-Za-z0-9_]{22,}`,
    String.raw`\bglpat-[A-Za-z0-9_-]{20,}`, // GitLab
    String.raw`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`, // AWS access key id
    String.raw`\bxox[abprs]-[A-Za-z0-9-]{10,}`, // Slack
    String.raw`\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}`, // Stripe
    String.raw`\bwhsec_[A-Za-z0-9]{20,}`,
    String.raw`\bAIza[0-9A-Za-z_-]{35}`, // Google
    String.raw`\bnpm_[A-Za-z0-9]{36}`, // npm
    String.raw`\bhf_[A-Za-z0-9]{30,}`, // Hugging Face
    String.raw`\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}`, // SendGrid
  ].join("|"),
  "g",
);

const AUTH_SCHEME_RE = /\b(Bearer|Basic|Token|Bot)(\s+)([A-Za-z0-9._~+/=-]{8,})/g;

const ENV_LINE_RE = /^([ \t]*(?:export[ \t]+)?)([A-Z][A-Z0-9_]*)([ \t]*=[ \t]*)(.*)$/gm;

const SENSITIVE_NAME =
  /pass(?:word|wd|phrase)?|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|credential|auth|session|cookie|signature|salt|dsn|database_url|conn(?:ection)?[_-]?str/i;

const SAFE_ENV_KEYS = new Set([
  "NODE_ENV", "PORT", "HOST", "LOG_LEVEL", "TZ", "CI", "DEBUG", "ENV", "ENVIRONMENT", "APP_ENV",
  "RAILS_ENV", "FLASK_ENV", "PYTHONUNBUFFERED", "NEXT_TELEMETRY_DISABLED", "LANG", "LC_ALL", "SHELL",
]);
const SIMPLE_VALUE_RE = /^(?:true|false|yes|no|on|off|null|\d{1,5}(?:\.\d+)?)$/i;

const KEY_VALUE_RE = new RegExp(
  String.raw`(["']?)([A-Za-z0-9_.-]*?(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|credentials?)[A-Za-z0-9_.-]*)\1(\s*[:=]\s*)(["']?)([^\s"'\x60,;{}()\[\]]{3,})\4`,
  "gi",
);
const NON_SECRET_VALUES = new Set([
  "null", "undefined", "true", "false", "none", "nil", "string", "number", "boolean", "any",
  "unknown", "never", "object", "required", "optional", "missing", "invalid", "expired", "***", "redacted",
]);

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const IPV4_RE =
  /(?<![\d.])(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(?![\d]|\.\d)/g;
const IPV6_CANDIDATE_RE = /(?<![\w:.])[0-9A-Fa-f:]*:[0-9A-Fa-f:]*:[0-9A-Fa-f:]*(?![\w:])/g;

const HIGH_ENTROPY_CANDIDATE_RE = /[A-Za-z0-9+/=_-]{20,}/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLoopbackOrUnspecifiedV4(ip: string) {
  return ip.startsWith("127.") || ip === "0.0.0.0" || ip === "255.255.255.255";
}

function isIpv6(candidate: string): boolean {
  if (candidate === "::1" || candidate === "::") return false;
  if (!/\d/.test(candidate)) return false;
  const doubleColon = candidate.split("::").length - 1;
  if (doubleColon > 1) return false;
  const groups = candidate.split(":").filter((g) => g !== "");
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return false;
  // Exige "::" ou 8 grupos — evita confundir com horários (12:34:56) e MACs.
  return doubleColon === 1 ? groups.length >= 2 && groups.length <= 7 : groups.length === 8;
}

/** Identificadores e caminhos legíveis (snake/kebab-case, pastas) não são segredos. */
function looksLikeIdentifierOrPath(value: string): boolean {
  const words = value.split(/[/_-]+/).filter(Boolean);
  const readable = words.filter((w) => /^[A-Za-z][a-z]{2,}$/.test(w) || /^[A-Z]{3,}$/.test(w));
  return words.length >= 2 && readable.length / words.length >= 0.5;
}

export function isHighEntropySecret(value: string): boolean {
  if (UUID_RE.test(value)) return false;
  if (/^[0-9a-f]+$/i.test(value)) return value.length >= 32 && /[a-f]/i.test(value) && /\d/.test(value);
  if (/^\d+$/.test(value) || looksLikeIdentifierOrPath(value)) return false;

  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const entropy = shannonEntropy(value);

  if (value.length >= 32 && hasDigit && (hasLower || hasUpper) && entropy >= 3.5) return true;
  return hasLower && hasUpper && hasDigit && entropy >= 3.7;
}

function applyRules(input: string, mask: Mask): string {
  let text = input;

  text = text.replace(PRIVATE_KEY_RE, (m) => mask("private_key", m));

  text = text.replace(URL_USERINFO_RE, (m, scheme: string, userinfo: string) => {
    if (FULL_PLACEHOLDER_RE.test(userinfo)) return m;
    if (!userinfo.includes(":") && userinfo.length < 16) return m;
    return `${scheme}${mask("url_credentials", userinfo)}@`;
  });

  text = text.replace(JWT_RE, (m) => mask("jwt", m));
  text = text.replace(KNOWN_TOKEN_RE, (m) => mask("token", m));
  text = text.replace(AUTH_SCHEME_RE, (_m, scheme: string, sp: string, value: string) =>
    `${scheme}${sp}${mask("auth_header", value)}`,
  );

  text = text.replace(ENV_LINE_RE, (m, prefix: string, key: string, eq: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    const quoted = trimmed.match(/^(["'])(.*)\1$/);
    const value = quoted ? quoted[2] : trimmed;
    if (!value || FULL_PLACEHOLDER_RE.test(value)) return m;
    const sensitive = SENSITIVE_NAME.test(key);
    if (!sensitive && (SAFE_ENV_KEYS.has(key) || SIMPLE_VALUE_RE.test(value))) return m;
    const q = quoted ? quoted[1] : "";
    return `${prefix}${key}${eq}${q}${mask(sensitive ? "secret" : "env_value", value)}${q}`;
  });

  text = text.replace(
    KEY_VALUE_RE,
    (m, kq: string, key: string, sep: string, vq: string, value: string) => {
      if (FULL_PLACEHOLDER_RE.test(value) || value.startsWith("[")) return m;
      if (NON_SECRET_VALUES.has(value.toLowerCase()) || /^\d{1,5}$/.test(value)) return m;
      return `${kq}${key}${kq}${sep}${vq}${mask("secret", value)}${vq}`;
    },
  );

  text = text.replace(EMAIL_RE, (m) => (/^git@/i.test(m) ? m : mask("email", m)));

  text = text.replace(IPV4_RE, (m) => (isLoopbackOrUnspecifiedV4(m) ? m : mask("ip", m)));
  text = text.replace(IPV6_CANDIDATE_RE, (m) => (isIpv6(m) ? mask("ip", m) : m));

  text = text.replace(HIGH_ENTROPY_CANDIDATE_RE, (m, offset: number, whole: string) => {
    // Não mexe no conteúdo de placeholders já inseridos.
    if (whole[offset - 1] === "[" || whole[offset + m.length] === "]") return m;
    return isHighEntropySecret(m) ? mask("high_entropy", m) : m;
  });

  return text;
}

export function sanitize(input: string): SanitizeResult {
  const { mask, items } = createMasker();
  const text = applyRules(input, mask);
  return { text, items };
}

/** Divide o texto em trechos normais e placeholders, para destacar na interface. */
export function splitPlaceholders(text: string): { text: string; placeholder: boolean }[] {
  const parts: { text: string; placeholder: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const index = m.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), placeholder: false });
    parts.push({ text: m[0], placeholder: true });
    last = index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), placeholder: false });
  return parts;
}

