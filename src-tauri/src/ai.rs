//! Envio do erro (já sanitizado no frontend) ao provedor de IA, com streaming.
//!
//! A requisição é feita aqui no Rust para que a API key, lida do keychain,
//! nunca seja exposta ao WebView. Os trechos de texto chegam ao frontend por
//! um `Channel` conforme o provedor os envia.

use crate::{
    billing::{BillingState, FREE_DAILY_LIMIT},
    history::HistoryState,
    prompt::{self, ErrorType},
    secrets,
    settings::{Provider, SettingsState},
};
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};
use tauri::{ipc::Channel, State};

const OPENAI_URL: &str = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MAX_OUTPUT_TOKENS: u32 = 2048;

/// Cada análise recebe um número de geração; cancelar (ou iniciar outra) incrementa
/// o contador e a análise anterior para de emitir na próxima leitura.
#[derive(Default)]
pub struct AnalysisState {
    generation: AtomicU64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeRequest {
    /// Texto JÁ sanitizado pelo frontend.
    pub text: String,
    pub error_type: ErrorType,
    #[serde(default)]
    pub secondary_types: Vec<ErrorType>,
}

enum LineEvent {
    Delta(String),
    Done,
    Skip,
}

#[tauri::command]
pub async fn analyze_error(
    settings: State<'_, SettingsState>,
    analysis: State<'_, AnalysisState>,
    billing: State<'_, BillingState>,
    history: State<'_, HistoryState>,
    request: AnalyzeRequest,
    on_delta: Channel<String>,
) -> Result<(), String> {
    let text = request.text.trim();
    if text.is_empty() {
        return Err("Paste an error or log to analyze.".into());
    }

    if !billing.is_pro() {
        let today = history.count_today_analyses()?;
        if today >= FREE_DAILY_LIMIT {
            return Err(format!(
                "Free plan daily limit reached ({today}/{FREE_DAILY_LIMIT} analyses today). Upgrade to Stackly Pro for unlimited analyses."
            ));
        }
    }

    let generation = &analysis.generation;
    let my_generation = generation.fetch_add(1, Ordering::SeqCst) + 1;
    let cfg = settings.get();
    let provider = cfg.provider;

    let api_key = if provider.needs_api_key() {
        let key = tauri::async_runtime::spawn_blocking(move || secrets::get_api_key(provider))
            .await
            .map_err(|e| e.to_string())??;
        Some(key.ok_or_else(|| {
            format!(
                "No {} API key configured. Open Settings to add one.",
                provider.display_name()
            )
        })?)
    } else {
        None
    };

    let system = prompt::system_prompt(request.error_type, &request.secondary_types, cfg.language);
    let user = prompt::user_message(&clip(text));
    let model = cfg.model();
    let client = http_client()?;

    let req = match provider {
        Provider::Openai => client
            .post(OPENAI_URL)
            .bearer_auth(api_key.as_deref().unwrap_or_default())
            .json(&json!({
                "model": model,
                "stream": true,
                "response_format": { "type": "json_object" },
                "messages": [
                    { "role": "system", "content": system },
                    { "role": "user", "content": user },
                ],
            })),
        Provider::Anthropic => client
            .post(ANTHROPIC_URL)
            .header("x-api-key", api_key.as_deref().unwrap_or_default())
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&json!({
                "model": model,
                "max_tokens": MAX_OUTPUT_TOKENS,
                "stream": true,
                "system": system,
                "messages": [{ "role": "user", "content": user }],
            })),
        Provider::Ollama => client
            .post(format!("{}/api/chat", cfg.ollama_url))
            .json(&json!({
                "model": model,
                "stream": true,
                "format": "json",
                "options": { "temperature": 0.2 },
                "messages": [
                    { "role": "system", "content": system },
                    { "role": "user", "content": user },
                ],
            })),
    };

    let resp = req.send().await.map_err(|e| {
        if provider == Provider::Ollama {
            format!(
                "Não foi possível conectar ao Ollama em {}. Ele está rodando? (ollama serve)",
                cfg.ollama_url
            )
        } else {
            format!("Falha de conexão com a {}: {}", provider.display_name(), e.without_url())
        }
    })?;

    if !resp.status().is_success() {
        return Err(http_error(provider, resp).await);
    }

    let mut stream = resp.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();
    let mut emitted = false;

    'read: while let Some(chunk) = stream.next().await {
        if generation.load(Ordering::SeqCst) != my_generation {
            return Ok(()); // cancelada
        }
        let chunk = chunk.map_err(|e| format!("A conexão foi interrompida: {}", e.without_url()))?;
        buffer.extend_from_slice(&chunk);

        for line in take_lines(&mut buffer) {
            match parse_line(provider, &line)? {
                LineEvent::Delta(text) if !text.is_empty() => {
                    emitted = true;
                    on_delta.send(text).map_err(|e| e.to_string())?;
                }
                LineEvent::Done => break 'read,
                _ => {}
            }
        }
    }

    // Última linha sem '\n' final.
    let rest = String::from_utf8_lossy(&buffer).trim().to_string();
    if !rest.is_empty() {
        if let LineEvent::Delta(text) = parse_line(provider, &rest)? {
            if !text.is_empty() {
                emitted = true;
                on_delta.send(text).map_err(|e| e.to_string())?;
            }
        }
    }

    if !emitted && generation.load(Ordering::SeqCst) == my_generation {
        return Err("O provedor não retornou nenhum conteúdo.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_analysis(analysis: State<'_, AnalysisState>) {
    analysis.generation.fetch_add(1, Ordering::SeqCst);
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(120))
        .user_agent(concat!("Stackly/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

/// Logs enormes: mantém o começo e (principalmente) o fim, onde costuma estar o erro.
fn clip(text: &str) -> String {
    const HEAD: usize = 6_000;
    const TAIL: usize = 24_000;
    let total = text.chars().count();
    if total <= HEAD + TAIL {
        return text.to_string();
    }
    let head: String = text.chars().take(HEAD).collect();
    let tail: String = text.chars().skip(total - TAIL).collect();
    format!(
        "{head}\n\n[... {} caracteres omitidos ...]\n\n{tail}",
        total - HEAD - TAIL
    )
}

/// Separa linhas completas por bytes (não quebra caracteres UTF-8 multibyte).
fn take_lines(buffer: &mut Vec<u8>) -> Vec<String> {
    let mut lines = Vec::new();
    while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
        let raw: Vec<u8> = buffer.drain(..=pos).collect();
        let line = String::from_utf8_lossy(&raw).trim().to_string();
        if !line.is_empty() {
            lines.push(line);
        }
    }
    lines
}

fn parse_line(provider: Provider, line: &str) -> Result<LineEvent, String> {
    match provider {
        // Server-Sent Events: "data: {...}"
        Provider::Openai | Provider::Anthropic => {
            let Some(data) = line.strip_prefix("data:") else {
                return Ok(LineEvent::Skip);
            };
            let data = data.trim();
            if data == "[DONE]" {
                return Ok(LineEvent::Done);
            }
            let Ok(v) = serde_json::from_str::<Value>(data) else {
                return Ok(LineEvent::Skip);
            };
            if let Some(err) = v.get("error") {
                return Err(format!("{}: {}", provider.display_name(), error_message(err)));
            }
            if provider == Provider::Openai {
                return Ok(v["choices"][0]["delta"]["content"]
                    .as_str()
                    .map(|s| LineEvent::Delta(s.to_string()))
                    .unwrap_or(LineEvent::Skip));
            }
            Ok(match v["type"].as_str() {
                Some("content_block_delta") => v["delta"]["text"]
                    .as_str()
                    .map(|s| LineEvent::Delta(s.to_string()))
                    .unwrap_or(LineEvent::Skip),
                Some("message_stop") => LineEvent::Done,
                _ => LineEvent::Skip,
            })
        }
        // NDJSON: um objeto por linha.
        Provider::Ollama => {
            let Ok(v) = serde_json::from_str::<Value>(line) else {
                return Ok(LineEvent::Skip);
            };
            if let Some(err) = v.get("error") {
                return Err(format!("Ollama: {}", error_message(err)));
            }
            if v["done"].as_bool() == Some(true) {
                return Ok(LineEvent::Done);
            }
            Ok(v["message"]["content"]
                .as_str()
                .map(|s| LineEvent::Delta(s.to_string()))
                .unwrap_or(LineEvent::Skip))
        }
    }
}

fn error_message(err: &Value) -> String {
    err.as_str()
        .or_else(|| err["message"].as_str())
        .map(str::to_string)
        .unwrap_or_else(|| err.to_string())
}

async fn http_error(provider: Provider, resp: reqwest::Response) -> String {
    let status = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();
    let detail = serde_json::from_str::<Value>(&body)
        .ok()
        .and_then(|v| v.get("error").map(error_message))
        .unwrap_or_else(|| body.chars().take(300).collect());
    let hint = match status {
        401 | 403 => "API key inválida ou sem permissão.",
        404 => "Modelo ou endpoint não encontrado — confira o nome do modelo.",
        429 => "Limite de uso atingido; tente novamente em instantes.",
        500..=599 => "Instabilidade no provedor; tente novamente.",
        _ => "",
    };
    format!("{} respondeu {status}. {hint} {detail}", provider.display_name())
        .trim()
        .to_string()
}

