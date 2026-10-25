// Notchy — a Dynamic Island for Windows.
//
// One transparent, always-on-top window at the top centre of the screen draws
// the island (src/). This side places it, decides click-through from a cursor
// poll, and hands the page what only the OS knows: now playing, Bluetooth
// devices, the charger, files dropped on it, and a few small documents.

// Built elsewhere only for development: the Windows-only helpers sit unused there.
#![cfg_attr(not(windows), allow(dead_code))]

mod devices;
mod island;
mod media;
mod platform;
mod shelf;
mod store;
mod tray;
#[cfg(windows)]
mod webview_drop;

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use island::{IslandRect, PollGate};

pub struct Shared {
    pub gate: Arc<PollGate>,
    zoom: Mutex<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PlatformInfo {
    os: &'static str,
    /// The island's hover comes from Rust's cursor poll, not page events.
    cursor_poll: bool,
    version: &'static str,
}

#[tauri::command]
fn platform_info() -> PlatformInfo {
    PlatformInfo {
        os: std::env::consts::OS,
        cursor_poll: platform::CURSOR_POLL,
        version: env!("CARGO_PKG_VERSION"),
    }
}

// ── Island window ─────────────────────────────────────────────────────────────

/// Hidden: the window shrinks to the wake strip and the cursor poll parks.
#[tauri::command]
fn set_collapsed(app: AppHandle, shared: State<Shared>, collapsed: bool) {
    shared.gate.collapsed.store(collapsed, Ordering::Relaxed);
    island::apply_geometry(&app, collapsed);
    island::refresh_click_through(&app, &shared.gate);
    shared.gate.set_active(!collapsed);
}

/// The island's current shape, for the click-through test.
#[tauri::command]
fn set_island_rect(shared: State<Shared>, x: f64, y: f64, width: f64, height: f64) {
    shared.gate.set_rect(IslandRect { x, y, w: width, h: height });
}

/// While a full-screen app runs, even the wake strip lets every click through.
#[tauri::command]
fn set_wake_enabled(app: AppHandle, shared: State<Shared>, enabled: bool) {
    if !shared.gate.collapsed.load(Ordering::Relaxed) {
        return;
    }
    if let Some(win) = island::window(&app) {
        let _ = win.set_ignore_cursor_events(!enabled);
    }
}

/// Keeps one CSS pixel equal to one logical window pixel (island.rs).
#[tauri::command]
fn fit_zoom(app: AppHandle, shared: State<Shared>, dpr: f64) -> bool {
    let Some(win) = island::window(&app) else { return false };
    let scale = win.scale_factor().unwrap_or(1.0);
    let mut zoom = shared.zoom.lock().unwrap();
    match island::zoom_correction(*zoom, scale, dpr) {
        Some(next) => {
            *zoom = next;
            let _ = win.set_zoom(next);
            true
        }
        None => false,
    }
}

/// A text field in the island is being used: let it take the keyboard.
#[tauri::command]
fn set_focusable(window: WebviewWindow, focusable: bool) {
    platform::set_activating(&window, focusable);
    if focusable {
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

// ── Documents ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn store_get(name: String) -> Option<Value> {
    store::get(&name)
}

#[tauri::command]
fn store_set(name: String, value: Value) -> Result<(), String> {
    store::set(&name, &value)
}

// ── Now playing ───────────────────────────────────────────────────────────────

#[tauri::command]
fn media_state() -> media::MediaState {
    media::current()
}

#[tauri::command]
async fn media_control(action: String, value: Option<f64>) -> bool {
    // The requests wait for the player's answer: off the main thread.
    tauri::async_runtime::spawn_blocking(move || media::control(&action, value))
        .await
        .unwrap_or(false)
}

// ── Devices ───────────────────────────────────────────────────────────────────

#[tauri::command]
fn bt_devices() -> Vec<devices::BtDevice> {
    devices::bt_devices()
}

#[tauri::command]
async fn power_state() -> devices::PowerState {
    tauri::async_runtime::spawn_blocking(devices::power_state).await.unwrap_or_default()
}

// ── Shelf ─────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn shelf_info(paths: Vec<String>) -> Vec<shelf::ShelfFile> {
    tauri::async_runtime::spawn_blocking(move || paths.iter().map(|p| shelf::describe(p)).collect())
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn shelf_open(path: String) -> bool {
    shelf::open(&path)
}

#[tauri::command]
fn shelf_reveal(path: String) -> bool {
    shelf::reveal(&path)
}

/// True once the drag is under way; `shelf-drag-end` follows when it is over.
#[tauri::command]
fn shelf_drag_out(app: AppHandle, window: WebviewWindow, paths: Vec<String>) -> bool {
    match shelf::drag_out(&app, window, paths) {
        Ok(()) => true,
        Err(err) => {
            eprintln!("[notchy] drag out: {err}");
            false
        }
    }
}

// ── Start with Windows ────────────────────────────────────────────────────────

#[tauri::command]
fn autostart_get(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn autostart_set(app: AppHandle, enabled: bool) -> bool {
    let manager = app.autolaunch();
    let _ = if enabled { manager.enable() } else { manager.disable() };
    let now = manager.is_enabled().unwrap_or(false);
    if let Some(tray) = app.try_state::<tray::TrayState>() {
        let _ = tray.autostart.set_checked(now);
    }
    now
}

pub fn run() {
    let gate = Arc::new(PollGate::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Launching Notchy again opens the island instead of a second one.
            let _ = app.emit_to(island::WINDOW_LABEL, "tray-open", "home");
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(Shared { gate: gate.clone(), zoom: Mutex::new(1.0) })
        .invoke_handler(tauri::generate_handler![
            platform_info,
            set_collapsed,
            set_island_rect,
            set_wake_enabled,
            fit_zoom,
            set_focusable,
            quit,
            store_get,
            store_set,
            media_state,
            media_control,
            bt_devices,
            power_state,
            shelf_info,
            shelf_open,
            shelf_reveal,
            shelf_drag_out,
            autostart_get,
            autostart_set,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            tray::build(&handle)?;

            if let Some(win) = island::window(&handle) {
                platform::make_non_activating(&win);
                #[cfg(windows)]
                webview_drop::install(&handle);
                island::apply_geometry(&handle, false);
                let _ = win.show();
            }
            // Nothing drawn yet: nothing takes the mouse until the page reports
            // the island's shape.
            island::refresh_click_through(&handle, &gate);
            gate.set_active(true);
            island::spawn_cursor_poll(handle.clone(), gate.clone());
            island::spawn_fullscreen_watch(handle.clone());

            media::start(&handle);
            devices::start(&handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Notchy");
}
