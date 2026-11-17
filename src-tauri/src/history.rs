//! Histórico local em SQLite com detecção de erros parecidos por trigramas.

use crate::billing::{BillingState, FREE_HISTORY_DAYS};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};

const SIMILARITY_THRESHOLD: f64 = 0.45;
const MAX_CANDIDATES_SCAN: usize = 300;

pub struct HistoryState {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub created_at: i64,
    pub sanitized_error: String,
    pub signature: String,
    pub error_type: String,
    pub project: Option<String>,
    pub response_json: String,
    pub resolved: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarMatch {
    pub entry: HistoryEntry,
    pub similarity: f64,
}

impl HistoryState {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Não foi possível localizar app_data_dir: {e}"))?;
        fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar pasta de dados: {e}"))?;
        let db_path = dir.join("stackly.db");
        let conn = Connection::open(db_path).map_err(|e| format!("Falha ao abrir SQLite: {e}"))?;

        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                sanitized_error TEXT NOT NULL,
                signature TEXT NOT NULL,
                error_type TEXT NOT NULL,
                project TEXT,
                response_json TEXT NOT NULL,
                resolved INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(error_type);
            CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses(project);
            ",
        )
        .map_err(|e| format!("Falha ao inicializar tabelas do histórico: {e}"))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn count_today_analyses(&self) -> Result<u32, String> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM analyses
                 WHERE date(created_at / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Falha ao contar análises de hoje: {e}"))?;
        Ok(count.max(0) as u32)
    }

    pub fn count_total_analyses(&self) -> Result<u64, String> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM analyses", [], |row| row.get(0))
            .map_err(|e| format!("Falha ao contar total de análises: {e}"))?;
        Ok(count.max(0) as u64)
    }
}

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn row_to_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<HistoryEntry> {
    let resolved_int: Option<i64> = row.get(7)?;
    Ok(HistoryEntry {
        id: row.get(0)?,
        created_at: row.get(1)?,
        sanitized_error: row.get(2)?,
        signature: row.get(3)?,
        error_type: row.get(4)?,
        project: row.get(5)?,
        response_json: row.get(6)?,
        resolved: resolved_int.map(|v| v != 0),
    })
}

/// Similaridade de Sørensen–Dice sobre trigramas de caracteres (0.0 a 1.0).
fn trigram_set(text: &str) -> HashSet<(char, char, char)> {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() < 3 {
        return HashSet::new();
    }
    chars.windows(3).map(|w| (w[0], w[1], w[2])).collect()
}

fn trigram_similarity(a: &str, b: &str) -> f64 {
    if a == b && !a.is_empty() {
        return 1.0;
    }
    let ta = trigram_set(a);
    let tb = trigram_set(b);
    if ta.is_empty() || tb.is_empty() {
        return 0.0;
    }
    let intersection = ta.intersection(&tb).count() as f64;
    (2.0 * intersection) / ((ta.len() + tb.len()) as f64)
}

#[tauri::command]
pub fn save_analysis(
    state: State<'_, HistoryState>,
    sanitized_error: String,
    signature: String,
    error_type: String,
    project: Option<String>,
    response_json: String,
) -> Result<HistoryEntry, String> {
    let project = project
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());
    let created_at = now_unix_ms();

    let conn = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute(
        "INSERT INTO analyses (created_at, sanitized_error, signature, error_type, project, response_json, resolved)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)",
        params![
            created_at,
            sanitized_error,
            signature,
            error_type,
            project,
            response_json
        ],
    )
    .map_err(|e| format!("Falha ao salvar análise no histórico: {e}"))?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, created_at, sanitized_error, signature, error_type, project, response_json, resolved
         FROM analyses WHERE id = ?1",
        params![id],
        row_to_entry,
    )
    .map_err(|e| format!("Falha ao ler análise salva: {e}"))
}

#[tauri::command]
pub fn set_analysis_resolved(
    state: State<'_, HistoryState>,
    id: i64,
    resolved: Option<bool>,
) -> Result<HistoryEntry, String> {
    let resolved_int: Option<i64> = resolved.map(|b| if b { 1 } else { 0 });
    let conn = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute(
        "UPDATE analyses SET resolved = ?1 WHERE id = ?2",
        params![resolved_int, id],
    )
    .map_err(|e| format!("Falha ao atualizar status da análise: {e}"))?;

    conn.query_row(
        "SELECT id, created_at, sanitized_error, signature, error_type, project, response_json, resolved
         FROM analyses WHERE id = ?1",
        params![id],
        row_to_entry,
    )
    .optional()
    .map_err(|e| format!("Falha ao buscar análise: {e}"))?
    .ok_or_else(|| "Análise não encontrada.".to_string())
}

#[tauri::command]
pub fn find_similar_analyses(
    state: State<'_, HistoryState>,
    billing: State<'_, BillingState>,
    signature: String,
    error_type: Option<String>,
) -> Result<Vec<SimilarMatch>, String> {
    if !billing.is_pro() {
        return Ok(Vec::new());
    }
    let sig = signature.trim();
    if sig.len() < 8 {
        return Ok(Vec::new());
    }

    let conn = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn
        .prepare(
            "SELECT id, created_at, sanitized_error, signature, error_type, project, response_json, resolved
             FROM analyses
             ORDER BY COALESCE(resolved, -1) DESC, created_at DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("Falha ao consultar histórico: {e}"))?;

    let rows = stmt
        .query_map(params![MAX_CANDIDATES_SCAN as i64], row_to_entry)
        .map_err(|e| format!("Falha ao ler histórico: {e}"))?;

    let mut matches: Vec<SimilarMatch> = Vec::new();
    for row in rows {
        let entry = row.map_err(|e| e.to_string())?;
        // Ignora análises marcadas explicitamente como "não resolveu" (👎).
        if entry.resolved == Some(false) {
            continue;
        }
        let mut sim = trigram_similarity(sig, &entry.signature);
        if let Some(ref et) = error_type {
            if &entry.error_type == et && et != "other" {
                sim = (sim + 0.05).min(1.0);
            }
        }
        if sim >= SIMILARITY_THRESHOLD {
            matches.push(SimilarMatch {
                entry,
                similarity: sim,
            });
        }
    }

    // Prioriza erros resolvidos (👍) e maior similaridade.
    matches.sort_by(|a, b| {
        let a_res = a.entry.resolved == Some(true);
        let b_res = b.entry.resolved == Some(true);
        b_res
            .cmp(&a_res)
            .then_with(|| {
                b.similarity
                    .partial_cmp(&a.similarity)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| b.entry.created_at.cmp(&a.entry.created_at))
    });
    matches.truncate(3);
    Ok(matches)
}

#[tauri::command]
pub fn list_history(
    state: State<'_, HistoryState>,
    billing: State<'_, BillingState>,
    query: Option<String>,
    error_type: Option<String>,
    project: Option<String>,
) -> Result<Vec<HistoryEntry>, String> {
    let min_created_at = if billing.is_pro() {
        0
    } else {
        now_unix_ms() - (FREE_HISTORY_DAYS * 24 * 60 * 60 * 1000)
    };

    let conn = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn
        .prepare(
            "SELECT id, created_at, sanitized_error, signature, error_type, project, response_json, resolved
             FROM analyses
             WHERE created_at >= ?1
             ORDER BY created_at DESC
             LIMIT 500",
        )
        .map_err(|e| format!("Falha ao listar histórico: {e}"))?;

    let q = query
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());
    let et = error_type.filter(|s| !s.is_empty() && s != "all");
    let proj = project.filter(|s| !s.is_empty() && s != "all");

    let rows = stmt
        .query_map(params![min_created_at], row_to_entry)
        .map_err(|e| format!("Falha ao ler histórico: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        let entry = row.map_err(|e| e.to_string())?;
        if let Some(ref filter_type) = et {
            if &entry.error_type != filter_type {
                continue;
            }
        }
        if let Some(ref filter_proj) = proj {
            if entry.project.as_deref() != Some(filter_proj.as_str()) {
                continue;
            }
        }
        if let Some(ref needle) = q {
            let haystack = format!(
                "{}\n{}\n{}",
                entry.sanitized_error,
                entry.response_json,
                entry.project.as_deref().unwrap_or("")
            )
            .to_lowercase();
            if !haystack.contains(needle) {
                continue;
            }
        }
        out.push(entry);
    }
    Ok(out)
}

#[tauri::command]
pub fn list_projects(state: State<'_, HistoryState>) -> Result<Vec<String>, String> {
    let conn = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT project FROM analyses
             WHERE project IS NOT NULL AND TRIM(project) != ''
             ORDER BY project COLLATE NOCASE ASC",
        )
        .map_err(|e| format!("Falha ao listar projetos: {e}"))?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Falha ao ler projetos: {e}"))?;

    let mut projects = Vec::new();
    for r in rows {
        projects.push(r.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

#[tauri::command]
pub fn delete_history_entry(state: State<'_, HistoryState>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute("DELETE FROM analyses WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir análise: {e}"))?;
    Ok(())
}

