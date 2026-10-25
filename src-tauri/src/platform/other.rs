// Linux and macOS: enough to run the island during development. The page
// drives the hover from its own mouse events (CURSOR_POLL is false).

use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::WebviewWindow;

pub const CURSOR_POLL: bool = false;

pub fn config_dir() -> PathBuf {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("notchy")
}

fn opener() -> &'static str {
    if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    }
}

pub fn open_path(path: &Path) -> bool {
    Command::new(opener()).arg(path).spawn().is_ok()
}

pub fn reveal_path(path: &Path) -> bool {
    match path.parent() {
        Some(dir) => Command::new(opener()).arg(dir).spawn().is_ok(),
        None => false,
    }
}

pub fn cursor_physical() -> Option<(f64, f64)> {
    None
}

pub fn left_button_down() -> bool {
    false
}

pub fn make_non_activating(_win: &WebviewWindow) {}

pub fn set_activating(_win: &WebviewWindow, _activating: bool) {}

pub fn fullscreen_app_running() -> bool {
    false
}
