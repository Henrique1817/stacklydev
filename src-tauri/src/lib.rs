//! Stackly — app de bandeja/barra de menu para Windows e macOS.

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
compile_error!("Stackly suporta apenas Windows e macOS.");

mod ai;
mod billing;
mod history;
mod prompt;
mod secrets;
mod settings;
mod updater;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime, WindowEvent, Wry,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const MAIN_WINDOW: &str = "main";
const MINIMIZED_ARG: &str = "--minimized";

#[cfg(target_os = "macos")]
const AUTOSTART_LABEL: &str = "Launch at login";
#[cfg(target_os = "windows")]
const AUTOSTART_LABEL: &str = "Start with Windows";

/// Item "Iniciar com o Windows" do menu da bandeja, guardado para mantê-lo sincronizado.
struct AutostartItem(CheckMenuItem<Wry>);

/// Cmd+Shift+E no macOS, Ctrl+Shift+E no Windows.
fn toggle_shortcut() -> Shortcut {
    let primary = if cfg!(target_os = "macos") {
        Modifiers::SUPER
    } else {
        Modifiers::CONTROL
    };
    Shortcut::new(Some(primary | Modifiers::SHIFT), Code::KeyE)
}

/// Atalho global é um recurso Pro: registra ou remove conforme o plano atual.
pub fn sync_global_shortcut(app: &AppHandle) {
    let is_pro = app
        .try_state::<billing::BillingState>()
        .map(|b| b.is_pro())
        .unwrap_or(false);
    let shortcut = toggle_shortcut();
    let gs = app.global_shortcut();
    if is_pro {
        if !gs.is_registered(shortcut) {
            if let Err(err) = gs.register(shortcut) {
                eprintln!("Não foi possível registrar o atalho global: {err}");
            }
        }
    } else if gs.is_registered(shortcut) {
        let _ = gs.unregister(shortcut);
    }
}

fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn toggle_main<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    if visible && focused {
        let _ = window.hide();
    } else {
        show_main(app);
    }
}

fn open_settings<R: Runtime>(app: &AppHandle<R>) {
    show_main(app);
    let _ = app.emit("navigate", "settings");
}

/// Ativa/desativa a inicialização automática e sincroniza a bandeja e o frontend.
fn apply_autostart(app: &AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    }
    .map_err(|e| e.to_string())?;

    let now = launcher.is_enabled().map_err(|e| e.to_string())?;
    if let Some(item) = app.try_state::<AutostartItem>() {
        let _ = item.0.set_checked(now);
    }
    let _ = app.emit("autostart-changed", now);
    Ok(now)
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    apply_autostart(&app, enabled)
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);

    let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        AUTOSTART_LABEL,
        true,
        autostart_enabled,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &autostart,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    app.manage(AutostartItem(autostart));

    let builder = TrayIconBuilder::with_id("main")
        .tooltip("Stackly")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "settings" => open_settings(app),
            "autostart" => {
                let current = app.autolaunch().is_enabled().unwrap_or(false);
                if let Err(err) = apply_autostart(app, !current) {
                    eprintln!("Falha ao alterar inicialização automática: {err}");
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });

    // macOS: ícone monocromático "template" (se adapta ao tema claro/escuro da barra
    // de menu) e menu abrindo no clique esquerdo, como é padrão no sistema.
    #[cfg(target_os = "macos")]
    let builder = builder
        .icon(tauri::include_image!("icons/tray-template/44x44.png"))
        .icon_as_template(true)
        .show_menu_on_left_click(true);

    // Windows: clique esquerdo abre/esconde a janela; clique direito abre o menu.
    #[cfg(target_os = "windows")]
    let builder = {
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
        builder
            .icon(tauri::include_image!("icons/tray/32x32.png"))
            .show_menu_on_left_click(false)
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    toggle_main(tray.app_handle());
                }
            })
    };

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Precisa ser o primeiro plugin: uma segunda execução apenas foca a janela existente.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main(app);
                    }
                })
                .build(),
        )
        .manage(ai::AnalysisState::default())
        .invoke_handler(tauri::generate_handler![
            get_autostart,
            set_autostart,
            settings::get_settings,
            settings::save_settings,
            secrets::set_api_key,
            secrets::has_api_key,
            secrets::delete_api_key,
            ai::analyze_error,
            ai::cancel_analysis,
            history::save_analysis,
            history::set_analysis_resolved,
            history::find_similar_analyses,
            history::list_history,
            history::list_projects,
            history::delete_history_entry,
            billing::get_billing_status,
            billing::activate_license,
            billing::revalidate_license,
            billing::deactivate_license,
            billing::open_checkout,
            updater::check_for_updates,
            updater::install_update,
        ])
        .setup(|app| {
            // macOS: só ícone na barra de menu, sem ícone no Dock.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            app.manage(settings::SettingsState::load(app.handle()));
            app.manage(history::HistoryState::open(app.handle())?);
            app.manage(billing::BillingState::load(app.handle()));
            setup_tray(app.handle())?;

            sync_global_shortcut(app.handle());
            updater::spawn_background_check(app.handle().clone());

            // Quando iniciado pelo login do sistema, fica apenas na bandeja.
            if !std::env::args().any(|a| a == MINIMIZED_ARG) {
                show_main(app.handle());
            }
            Ok(())
        })
        // Fechar a janela apenas a esconde; o app continua na bandeja até "Sair".
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Stackly");
}

