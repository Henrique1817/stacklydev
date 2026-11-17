//! Verificação e instalação de atualizações via Tauri Updater (GitHub Releases).

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
}

/// Checa silenciosamente em background ao abrir o app.
pub fn spawn_background_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Ok(updater) = app.updater() else {
            return;
        };
        if let Ok(Some(update)) = updater.check().await {
            let _ = app.emit(
                "update-available",
                UpdateInfo {
                    available: true,
                    version: Some(update.version),
                    notes: update.body,
                },
            );
        }
    });
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Updater indisponível: {e}"))?;
    match updater.check().await.map_err(|e| format!("Falha ao buscar atualizações: {e}"))? {
        Some(update) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version),
            notes: update.body,
        }),
        None => Ok(UpdateInfo {
            available: false,
            version: None,
            notes: None,
        }),
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Updater indisponível: {e}"))?;
    let Some(update) = updater
        .check()
        .await
        .map_err(|e| format!("Falha ao verificar atualização: {e}"))?
    else {
        return Ok(());
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| format!("Falha ao baixar/instalar atualização: {e}"))?;

    app.restart();
}

