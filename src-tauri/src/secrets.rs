//! API keys guardadas no cofre do sistema operacional:
//! Keychain no macOS e Gerenciador de Credenciais no Windows.
//!
//! A chave nunca é gravada em disco pelo Stackly e nunca volta para o frontend:
//! os comandos expostos só permitem salvar, verificar a existência e remover.

use crate::settings::Provider;
use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "com.stackly.app";
const LICENSE_ACCOUNT: &str = "stripe-license-key";

fn license_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, LICENSE_ACCOUNT).map_err(keychain_error)
}

pub fn get_license_key() -> Result<Option<String>, String> {
    match license_entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(keychain_error(err)),
    }
}

pub fn set_license_key(key: &str) -> Result<(), String> {
    license_entry()?.set_password(key).map_err(keychain_error)
}

pub fn delete_license_key() -> Result<(), String> {
    match license_entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(keychain_error(err)),
    }
}

fn entry(provider: Provider) -> Result<Entry, String> {
    let account = match provider {
        Provider::Openai => "openai-api-key",
        Provider::Anthropic => "anthropic-api-key",
        Provider::Ollama => return Err("O Ollama local não usa API key.".into()),
    };
    Entry::new(SERVICE, account).map_err(keychain_error)
}

fn keychain_error(err: KeyringError) -> String {
    format!("Erro ao acessar o cofre de senhas do sistema: {err}")
}

/// Uso interno (backend) — lê a chave para montar a requisição ao provedor.
pub fn get_api_key(provider: Provider) -> Result<Option<String>, String> {
    match entry(provider)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(keychain_error(err)),
    }
}

// Comandos `async` rodam fora da thread principal: o acesso ao keychain pode
// bloquear (ex.: o macOS pedindo permissão ao usuário).

#[tauri::command]
pub async fn set_api_key(provider: Provider, key: String) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("A API key está vazia.".into());
    }
    if key.len() > 512 || key.chars().any(char::is_whitespace) {
        return Err("A API key parece inválida (contém espaços ou é longa demais).".into());
    }
    entry(provider)?.set_password(key).map_err(keychain_error)
}

#[tauri::command]
pub async fn has_api_key(provider: Provider) -> Result<bool, String> {
    if !provider.needs_api_key() {
        return Ok(true);
    }
    Ok(get_api_key(provider)?.is_some())
}

#[tauri::command]
pub async fn delete_api_key(provider: Provider) -> Result<(), String> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(keychain_error(err)),
    }
}

