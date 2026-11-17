import { invoke } from "@tauri-apps/api/core";
import type { ErrorType } from "./detector";

export interface HistoryEntry {
  id: number;
  createdAt: number;
  sanitizedError: string;
  signature: string;
  errorType: ErrorType;
  project: string | null;
  responseJson: string;
  resolved: boolean | null;
}

export interface SimilarMatch {
  entry: HistoryEntry;
  similarity: number;
}

export const saveAnalysis = (params: {
  sanitizedError: string;
  signature: string;
  errorType: ErrorType;
  project: string | null;
  responseJson: string;
}) => invoke<HistoryEntry>("save_analysis", params);

export const setAnalysisResolved = (id: number, resolved: boolean | null) =>
  invoke<HistoryEntry>("set_analysis_resolved", { id, resolved });

export const findSimilarAnalyses = (signature: string, errorType?: ErrorType) =>
  invoke<SimilarMatch[]>("find_similar_analyses", { signature, errorType: errorType ?? null });

export const listHistory = (params?: {
  query?: string;
  errorType?: ErrorType | "all";
  project?: string | "all";
}) =>
  invoke<HistoryEntry[]>("list_history", {
    query: params?.query ?? null,
    errorType: params?.errorType ?? null,
    project: params?.project ?? null,
  });

export const listProjects = () => invoke<string[]>("list_projects");

export const deleteHistoryEntry = (id: number) => invoke<void>("delete_history_entry", { id });

