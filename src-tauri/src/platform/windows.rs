// Windows: Win32 for the island window and the cursor, %APPDATA% for files.

use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::WebviewWindow;

use ::windows::core::{w, HSTRING};
use ::windows::Win32::Foundation::{HWND, POINT};
use ::windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
use ::windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, ShellExecuteW, QUNS_BUSY, QUNS_PRESENTATION_MODE,
    QUNS_RUNNING_D3D_FULL_SCREEN,
};
use ::windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, SW_SHOWNORMAL,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};

/// Windows hands out the global cursor position, so a poll drives the hover
/// and the click-through (island.rs).
pub const CURSOR_POLL: bool = true;

/// Keeps spawned helpers from flashing a console window.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// ── Files ─────────────────────────────────────────────────────────────────────

/// %APPDATA%\Notchy — preferences, to-dos, the water log and the shelf.
pub fn config_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("Notchy")
}

/// Opens a file or folder with whatever Windows associates with it.
pub fn open_path(path: &Path) -> bool {
    let target = HSTRING::from(path.as_os_str());
    let result = unsafe { ShellExecuteW(None, w!("open"), &target, None, None, SW_SHOWNORMAL) };
    // ShellExecute reports success as a value above 32.
    result.0 as isize > 32
}

/// Shows a file selected in its Explorer folder.
pub fn reveal_path(path: &Path) -> bool {
    // Explorer parses its own command line: `/select,"C:\a b\c.txt"` must reach
    // it exactly like that, which Rust's argument quoting would not produce.
    Command::new("explorer")
        .raw_arg(format!("/select,\"{}\"", path.display()))
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .is_ok()
}

// ── Cursor ────────────────────────────────────────────────────────────────────

pub fn cursor_physical() -> Option<(f64, f64)> {
    let mut p = POINT::default();
    unsafe { GetCursorPos(&mut p).ok()? };
    Some((p.x as f64, p.y as f64))
}

/// True while the left mouse button is held — the only sign that a file drag
/// may be on its way before it reaches the window.
pub fn left_button_down() -> bool {
    unsafe { (GetAsyncKeyState(VK_LBUTTON.0 as i32) as u16 & 0x8000) != 0 }
}

// ── Island window ─────────────────────────────────────────────────────────────

fn hwnd_of(win: &WebviewWindow) -> Option<HWND> {
    let raw = win.hwnd().ok()?.0 as isize;
    if raw == 0 {
        return None;
    }
    Some(HWND(raw as *mut _))
}

/// WS_EX_NOACTIVATE keeps a click on the island from stealing focus from the
/// app you are typing in; WS_EX_TOOLWINDOW keeps it out of Alt-Tab.
pub fn make_non_activating(win: &WebviewWindow) {
    let Some(hwnd) = hwnd_of(win) else { return };
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let want = ex | WS_EX_NOACTIVATE.0 as isize | WS_EX_TOOLWINDOW.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, want);
    }
}

/// Lets the island take the keyboard while a text field in it is used (a new
/// to-do), and gives it back afterwards.
pub fn set_activating(win: &WebviewWindow, activating: bool) {
    let Some(hwnd) = hwnd_of(win) else { return };
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let want = if activating {
            ex & !(WS_EX_NOACTIVATE.0 as isize)
        } else {
            ex | WS_EX_NOACTIVATE.0 as isize
        };
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, want);
    }
}

/// A full-screen game, video or presentation is in front: the island steps aside.
pub fn fullscreen_app_running() -> bool {
    match unsafe { SHQueryUserNotificationState() } {
        Ok(state) => {
            state == QUNS_BUSY || state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE
        }
        Err(_) => false,
    }
}
