//! Configurações não sensíveis (provedor, modelos, idioma), salvas em JSON no
//! diretório de configuração do app. API keys NÃO ficam aqui — veja `secrets.rs`.

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    #[default]
    Openai,
    Anthropic,
    Ollama,
}

impl Provider {
    pub fn needs_api_key(self) -> bool {
        !matches!(self, Provider::Ollama)
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Provider::Openai => "OpenAI",
            Provider::Anthropic => "Anthropic",
            Provider::Ollama => "Ollama",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Language {
    #[serde(rename = "pt-BR")]
    PtBr,
    #[default]
    #[serde(rename = "en")]
    En,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub provider: Provider,
    pub openai_model: String,
    pub anthropic_model: String,
    pub ollama_model: String,
    pub ollama_url: String,
    pub language: Language,
}

const DEFAULT_OPENAI_MODEL: &str = "gpt-4o-mini";
const DEFAULT_ANTHROPIC_MODEL: &str = "claude-sonnet-4-5";
const DEFAULT_OLLAMA_MODEL: &str = "llama3.1";
const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";

impl Default for Settings {
    fn default() -> Self {
        Self {
            provider: Provider::default(),
            openai_model: DEFAULT_OPENAI_MODEL.into(),
            anthropic_model: DEFAULT_ANTHROPIC_MODEL.into(),
            ollama_model: DEFAULT_OLLAMA_MODEL.into(),
            ollama_url: DEFAULT_OLLAMA_URL.into(),
            language: Language::default(),
        }
    }
}

impl Settings {
    pub fn model(&self) -> &str {
        match self.provider {
            Provider::Openai => &self.openai_model,
            Provider::Anthropic => &self.anthropic_model,
            Provider::Ollama => &self.ollama_model,
        }
    }

    fn validated(mut self) -> Result<Self, String> {
        fn or_default(value: &str, default: &str) -> String {
            let v = value.trim();
            if v.is_empty() { default.into() } else { v.into() }
        }
        self.openai_model = or_default(&self.openai_model, DEFAULT_OPENAI_MODEL);
        self.anthropic_model = or_default(&self.anthropic_model, DEFAULT_ANTHROPIC_MODEL);
        self.ollama_model = or_default(&self.ollama_model, DEFAULT_OLLAMA_MODEL);

        let url = or_default(&self.ollama_url, DEFAULT_OLLAMA_URL);
        let parsed = reqwest::Url::parse(&url).map_err(|_| format!("URL do Ollama inválida: {url}"))?;
        if !matches!(parsed.scheme(), "http" | "https") {
            return Err("A URL do Ollama deve começar com http:// ou https://".into());
        }
        self.ollama_url = url.trim_end_matches('/').to_string();
        Ok(self)
    }
}

pub struct SettingsState {
    path: PathBuf,
    inner: Mutex<Settings>,
}

impl SettingsState {
    pub fn load(app: &AppHandle) -> Self {
        let path = app
            .path()
            .app_config_dir()
            .map(|dir| dir.join("settings.json"))
            .unwrap_or_else(|_| PathBuf::from("settings.json"));
        let settings = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Settings>(&raw).ok())
            .and_then(|s| s.validated().ok())
            .unwrap_or_default();
        Self { path, inner: Mutex::new(settings) }
    }

    pub fn get(&self) -> Settings {
        self.inner.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    fn save(&self, settings: Settings) -> Result<(), String> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir).map_err(|e| format!("Não foi possível criar a pasta de configuração: {e}"))?;
        }
        let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
        // Grava em arquivo temporário e renomeia, para não corromper em caso de falha.
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, json).map_err(|e| format!("Falha ao salvar configurações: {e}"))?;
        fs::rename(&tmp, &self.path).map_err(|e| format!("Falha ao salvar configurações: {e}"))?;
        *self.inner.lock().unwrap_or_else(|e| e.into_inner()) = settings;
        Ok(())
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, SettingsState>) -> Settings {
    state.get()
}

#[tauri::command]
pub fn save_settings(state: State<'_, SettingsState>, settings: Settings) -> Result<Settings, String> {
    let settings = settings.validated()?;
    state.save(settings.clone())?;
    Ok(settings)
}

