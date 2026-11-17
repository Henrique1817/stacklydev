import { Channel, invoke } from "@tauri-apps/api/core";
import type { ErrorType } from "./detector";

/** Formato de resposta exigido da IA. */
export interface Analysis {
  titulo?: string;
  causaProvavel?: string;
  ondeOlhar?: string[];
  passosParaCorrigir?: string[];
  comando?: string;
  trechoDeCodigo?: string;
  confianca?: number;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
const strList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : undefined;

/** Normaliza o objeto (possivelmente parcial) vindo da IA. */
export function toAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const confianca =
    typeof v.confianca === "number" && Number.isFinite(v.confianca)
      ? Math.min(1, Math.max(0, v.confianca > 1 ? v.confianca / 100 : v.confianca))
      : undefined;
  return {
    titulo: str(v.titulo),
    causaProvavel: str(v.causaProvavel),
    ondeOlhar: strList(v.ondeOlhar),
    passosParaCorrigir: strList(v.passosParaCorrigir)?.map((s) => s.replace(/^\s*\d+[.)]\s+/, "")),
    comando: str(v.comando),
    trechoDeCodigo: str(v.trechoDeCodigo),
    confianca,
  };
}

/**
 * Inicia a análise. `sanitizedText` deve vir do sanitizador — o backend só
 * recebe o texto já mascarado. Os trechos da resposta chegam por `onDelta`.
 */
export function analyzeError(
  sanitizedText: string,
  errorType: ErrorType,
  secondaryTypes: ErrorType[],
  onDelta: (chunk: string) => void,
): Promise<void> {
  const channel = new Channel<string>();
  channel.onmessage = onDelta;
  return invoke<void>("analyze_error", {
    request: { text: sanitizedText, errorType, secondaryTypes },
    onDelta: channel,
  });
}

export const cancelAnalysis = () => invoke<void>("cancel_analysis");

