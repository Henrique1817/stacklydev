//! Cobrança e licenciamento via Stripe (Payment Link + validação server-side),
//! com cache offline de 7 dias.
//!
//! - Grátis: 5 análises/dia e histórico dos últimos 7 dias.
//! - Pro ($2.99/mo): unlimited analyses, full history, bug memory, and global shortcut.
//!   e atalho global.
//!
//! A chave/ID da assinatura é guardada no keychain do sistema (`secrets.rs`),
//! nunca em texto puro em disco. Apenas os metadados de validação ficam em
//! `license_cache.json`.

use crate::{history::HistoryState, secrets};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

pub const FREE_DAILY_LIMIT: u32 = 5;
pub const FREE_HISTORY_DAYS: i64 = 7;
const OFFLINE_CACHE_MS: i64 = 7 * 24 * 60 * 60 * 1000; // 7 dias
const MINUTES_SAVED_PER_ANALYSIS: u64 = 10;

// Substitua pelo seu Stripe Payment Link e pelo domínio da sua API na Vercel.
const STRIPE_CHECKOUT_URL: &str = "https://buy.stripe.com/seu-payment-link";
const STRIPE_LICENSE_API_URL: &str = "https://stackly.vercel.app/api/stripe/license";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct LicenseCache {
    subscription_id: Option<String>,
    status: Option<String>,
    last_validated_at: Option<i64>,
    customer_email: Option<String>,
}

pub struct BillingState {
    cache_path: PathBuf,
    cache: Mutex<LicenseCache>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingStatus {
    pub is_pro: bool,
    pub plan: &'static str,
    pub today_used: u32,
    pub daily_limit: u32,
    pub total_analyses: u64,
    pub estimated_minutes_saved: u64,
    pub last_validated_at: Option<i64>,
    pub offline_valid_until: Option<i64>,
    pub customer_email: Option<String>,
    pub checkout_url: &'static str,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

impl BillingState {
    pub fn load(app: &AppHandle) -> Self {
        let cache_path = app
            .path()
            .app_config_dir()
            .map(|d| d.join("license_cache.json"))
            .unwrap_or_else(|_| PathBuf::from("license_cache.json"));

        let cache = fs::read_to_string(&cache_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<LicenseCache>(&raw).ok())
            .unwrap_or_default();

        Self {
            cache_path,
            cache: Mutex::new(cache),
        }
    }

    pub fn is_pro(&self) -> bool {
        let guard = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        is_cache_valid(&guard, now_ms())
    }

    fn save_cache(&self, next: LicenseCache) -> Result<(), String> {
        if let Some(dir) = self.cache_path.parent() {
            fs::create_dir_all(dir)
                .map_err(|e| format!("Falha ao criar pasta de configuração: {e}"))?;
        }
        let json = serde_json::to_string_pretty(&next).map_err(|e| e.to_string())?;
        let tmp = self.cache_path.with_extension("json.tmp");
        fs::write(&tmp, json).map_err(|e| format!("Falha ao salvar cache da licença: {e}"))?;
        fs::rename(&tmp, &self.cache_path)
            .map_err(|e| format!("Falha ao salvar cache da licença: {e}"))?;
        *self.cache.lock().unwrap_or_else(|e| e.into_inner()) = next;
        Ok(())
    }

    fn snapshot(&self) -> LicenseCache {
        self.cache.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
}

fn is_cache_valid(cache: &LicenseCache, now: i64) -> bool {
    let active = matches!(cache.status.as_deref(), Some("active" | "trialing"));
    let Some(last) = cache.last_validated_at else {
        return false;
    };
    active && (now - last) <= OFFLINE_CACHE_MS
}

fn build_status(billing: &BillingState, history: &HistoryState) -> Result<BillingStatus, String> {
    let cache = billing.snapshot();
    let now = now_ms();
    let is_pro = is_cache_valid(&cache, now);
    let today_used = history.count_today_analyses()?;
    let total_analyses = history.count_total_analyses()?;

    Ok(BillingStatus {
        is_pro,
        plan: if is_pro { "pro" } else { "free" },
        today_used,
        daily_limit: FREE_DAILY_LIMIT,
        total_analyses,
        estimated_minutes_saved: total_analyses * MINUTES_SAVED_PER_ANALYSIS,
        last_validated_at: cache.last_validated_at,
        offline_valid_until: cache.last_validated_at.map(|t| t + OFFLINE_CACHE_MS),
        customer_email: cache.customer_email,
        checkout_url: STRIPE_CHECKOUT_URL,
    })
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(20))
        .user_agent(concat!("Stackly/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

async fn verify_with_stripe_api(key: &str) -> Result<LicenseCache, String> {
    let client = http_client()?;
    let resp = client
        .post(STRIPE_LICENSE_API_URL)
        .header("Accept", "application/json")
        .json(&json!({ "licenseKey": key }))
        .send()
        .await
        .map_err(|e| format!("Falha ao validar assinatura na Stripe: {}", e.without_url()))?;

    let status_code = resp.status();
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Resposta inválida do servidor de licença: {e}"))?;

    if !status_code.is_success() || !body["valid"].as_bool().unwrap_or(false) {
        let msg = body["error"]
            .as_str()
            .unwrap_or("Stripe subscription not found or inactive.");
        return Err(msg.to_string());
    }

    Ok(LicenseCache {
        subscription_id: body["subscriptionId"].as_str().map(str::to_string),
        status: Some(
            body["status"]
                .as_str()
                .unwrap_or("active")
                .to_string(),
        ),
        last_validated_at: Some(now_ms()),
        customer_email: body["customerEmail"].as_str().map(str::to_string),
    })
}

#[tauri::command]
pub fn get_billing_status(
    billing: State<'_, BillingState>,
    history: State<'_, HistoryState>,
) -> Result<BillingStatus, String> {
    build_status(&billing, &history)
}

#[tauri::command]
pub async fn activate_license(
    app: AppHandle,
    billing: State<'_, BillingState>,
    history: State<'_, HistoryState>,
    license_key: String,
) -> Result<BillingStatus, String> {
    let key = license_key.trim().to_string();
    if key.is_empty() {
        return Err("Paste your Stripe subscription ID (sub_...) or checkout email.".into());
    }

    let next_cache = verify_with_stripe_api(&key).await?;
    let key_to_store = next_cache.subscription_id.clone().unwrap_or(key);

    tauri::async_runtime::spawn_blocking(move || secrets::set_license_key(&key_to_store))
        .await
        .map_err(|e| e.to_string())??;

    billing.save_cache(next_cache)?;
    crate::sync_global_shortcut(&app);
    let result = build_status(&billing, &history)?;
    let _ = app.emit("billing-changed", &result);
    Ok(result)
}

#[tauri::command]
pub async fn revalidate_license(
    app: AppHandle,
    billing: State<'_, BillingState>,
    history: State<'_, HistoryState>,
) -> Result<BillingStatus, String> {
    let key = tauri::async_runtime::spawn_blocking(secrets::get_license_key)
        .await
        .map_err(|e| e.to_string())??;

    let Some(key) = key else {
        return build_status(&billing, &history);
    };

    match verify_with_stripe_api(&key).await {
        Ok(next_cache) => {
            billing.save_cache(next_cache)?;
        }
        Err(err) => {
            // Se a assinatura foi cancelada/expirada no servidor, revoga localmente;
            // se foi falha de rede, mantém o cache offline de 7 dias.
            if err.contains("inativa") || err.contains("não encontrada") {
                let mut current = billing.snapshot();
                current.status = Some("inactive".into());
                current.last_validated_at = Some(now_ms());
                billing.save_cache(current)?;
            } else {
                return Err(format!("{err} (usando cache offline se ainda válido)"));
            }
        }
    }

    crate::sync_global_shortcut(&app);
    let result = build_status(&billing, &history)?;
    let _ = app.emit("billing-changed", &result);
    Ok(result)
}

#[tauri::command]
pub async fn deactivate_license(
    app: AppHandle,
    billing: State<'_, BillingState>,
    history: State<'_, HistoryState>,
) -> Result<BillingStatus, String> {
    tauri::async_runtime::spawn_blocking(secrets::delete_license_key)
        .await
        .map_err(|e| e.to_string())??;

    billing.save_cache(LicenseCache::default())?;
    crate::sync_global_shortcut(&app);
    let result = build_status(&billing, &history)?;
    let _ = app.emit("billing-changed", &result);
    Ok(result)
}

#[tauri::command]
pub fn open_checkout() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("cmd")
        .args(["/C", "start", "", STRIPE_CHECKOUT_URL])
        .status();

    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("open")
        .arg(STRIPE_CHECKOUT_URL)
        .status();

    status
        .map_err(|e| format!("Não foi possível abrir o navegador: {e}"))?
        .success()
        .then_some(())
        .ok_or_else(|| "Falha ao abrir a página de checkout da Stripe.".to_string())
}
