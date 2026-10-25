// The tray icon: the way back to the island, its settings, and Quit.

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

use crate::island::WINDOW_LABEL;

/// The menu's "Start with Windows" tick, kept so the island's Settings can move it too.
pub struct TrayState {
    pub autostart: CheckMenuItem<Wry>,
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Notchy", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart = CheckMenuItem::with_id(app, "autostart", "Start with Windows", true, autostart_on, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Notchy", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open, &settings, &PredefinedMenuItem::separator(app)?, &autostart, &PredefinedMenuItem::separator(app)?, &quit],
    )?;

    let toggle = autostart.clone();
    let mut builder = TrayIconBuilder::with_id("notchy")
        .tooltip("Notchy")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open" => {
                let _ = app.emit_to(WINDOW_LABEL, "tray-open", "home");
            }
            "settings" => {
                let _ = app.emit_to(WINDOW_LABEL, "tray-open", "settings");
            }
            "autostart" => {
                let manager = app.autolaunch();
                let on = !manager.is_enabled().unwrap_or(false);
                let _ = if on { manager.enable() } else { manager.disable() };
                let _ = toggle.set_checked(manager.is_enabled().unwrap_or(on));
                let _ = app.emit_to(WINDOW_LABEL, "autostart-changed", on);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let _ = tray.app_handle().emit_to(WINDOW_LABEL, "tray-open", "home");
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    app.manage(TrayState { autostart });
    Ok(())
}
