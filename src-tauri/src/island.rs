// The island window: placement at the top centre of the primary display, the
// two window sizes (full panel / invisible wake strip), click-through and the
// cursor poll. The approach follows Coucou's Windows island (MIT,
// github.com/Louis-CFM/coucou): a borderless, transparent, always-on-top window
// that never takes focus, with the island drawn inside it.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::platform;

/// Logical size of the full window: the largest island view plus room for its
/// shadow. The island is drawn inside, glued to the top edge.
pub const PANEL_W: f64 = 720.0;
pub const PANEL_H: f64 = 300.0;
/// Logical size of the invisible strip that wakes a hidden island.
pub const STRIP_W: f64 = 260.0;
pub const STRIP_H: f64 = 6.0;

pub const WINDOW_LABEL: &str = "island";

/// Margin around the island that still counts as "on the island", logical px.
const HIT_MARGIN: f64 = 14.0;
/// While a button is held this far below the island, a file drag can still find
/// the window (see the poll).
const DROP_MARGIN: f64 = 70.0;
/// Further than this from the island, the cursor is read less often.
const NEAR: f64 = 160.0;

#[derive(Serialize, Clone)]
pub struct CursorPayload {
    pub x: f64,
    pub y: f64,
}

/// The island shape in window-logical coordinates, pushed by the page. The poll
/// thread owns the click-through decision so it lands in the same tick as the
/// cursor read: an IPC round trip there loses clicks.
#[derive(Clone, Copy, Default)]
pub struct IslandRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl IslandRect {
    fn contains(&self, x: f64, y: f64, margin: f64) -> bool {
        self.w > 0.0
            && x >= self.x - margin
            && x <= self.x + self.w + margin
            && y >= self.y - margin
            && y <= self.y + self.h + margin
    }

    /// Distance from a point to the rectangle, 0 inside.
    fn distance(&self, x: f64, y: f64) -> f64 {
        let dx = (self.x - x).max(0.0).max(x - (self.x + self.w));
        let dy = (self.y - y).max(0.0).max(y - (self.y + self.h));
        (dx * dx + dy * dy).sqrt()
    }
}

/// Wakes and parks the cursor poll, so a hidden island costs nothing.
pub struct PollGate {
    active: Mutex<bool>,
    cv: Condvar,
    pub collapsed: AtomicBool,
    pub rect: Mutex<IslandRect>,
    /// The page drew a new shape: decide click-through again even if the
    /// cursor has not moved (the island may have folded away from under it).
    rect_changed: AtomicBool,
    /// Mirrors the window flag so the OS is only called when it changes.
    ignoring: AtomicBool,
}

impl PollGate {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(false),
            cv: Condvar::new(),
            collapsed: AtomicBool::new(false),
            rect: Mutex::new(IslandRect::default()),
            rect_changed: AtomicBool::new(false),
            ignoring: AtomicBool::new(false),
        }
    }

    pub fn set_rect(&self, rect: IslandRect) {
        *self.rect.lock().unwrap() = rect;
        self.rect_changed.store(true, Ordering::Relaxed);
    }

    /// Forces the next tick to apply the flag again (after a resize).
    pub fn forget_ignore_state(&self) {
        self.ignoring.store(false, Ordering::Relaxed);
    }

    pub fn set_active(&self, on: bool) {
        let mut guard = self.active.lock().unwrap();
        *guard = on;
        self.cv.notify_all();
    }

    fn wait_until_active(&self) {
        let mut guard = self.active.lock().unwrap();
        while !*guard {
            guard = self.cv.wait(guard).unwrap();
        }
    }

    fn is_active(&self) -> bool {
        *self.active.lock().unwrap()
    }
}

pub fn window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(WINDOW_LABEL)
}

fn target_monitor(app: &AppHandle) -> Option<Monitor> {
    app.primary_monitor()
        .ok()
        .flatten()
        .or_else(|| app.available_monitors().ok()?.into_iter().next())
}

/// Places and sizes the window. `collapsed` picks the wake strip.
pub fn apply_geometry(app: &AppHandle, collapsed: bool) {
    let Some(win) = window(app) else { return };
    let Some(m) = target_monitor(app) else { return };

    let scale = m.scale_factor();
    let mp = *m.position();
    let ms = *m.size();
    let (lw, lh) = if collapsed { (STRIP_W, STRIP_H) } else { (PANEL_W, PANEL_H) };
    let pw = (lw * scale).round().max(1.0) as u32;
    let ph = (lh * scale).round().max(1.0) as u32;
    let x = mp.x + (ms.width as i32 - pw as i32) / 2;
    let y = mp.y;

    #[cfg(target_os = "linux")]
    let _ = win.set_resizable(true);
    let _ = win.set_size(PhysicalSize::new(pw, ph));
    let _ = win.set_position(PhysicalPosition::new(x, y));
    // Moving across displays can rescale the window: assert the size again.
    let _ = win.set_size(PhysicalSize::new(pw, ph));
    let _ = win.set_always_on_top(true);
}

/// The webview's devicePixelRatio can differ from the window's scale (text
/// scaling, mixed-DPI setups). Zooming the webview by the ratio keeps one CSS
/// pixel equal to one logical window pixel, so the island is never clipped.
pub fn zoom_correction(current_zoom: f64, scale: f64, dpr: f64) -> Option<f64> {
    if dpr <= 0.0 || !dpr.is_finite() || scale <= 0.0 || !scale.is_finite() {
        return None;
    }
    if (dpr - scale).abs() / scale < 0.02 {
        return None;
    }
    Some((current_zoom * (scale / dpr)).clamp(0.25, 4.0))
}

/// Position, size and scale of the display the island lives on.
fn screen_key(app: &AppHandle) -> Option<(i32, i32, u32, u32, u64)> {
    let m = target_monitor(app)?;
    let p = m.position();
    let s = m.size();
    Some((p.x, p.y, s.width, s.height, m.scale_factor().to_bits()))
}

/// Emits `cursor` (window-logical coordinates) while the island is shown, and
/// decides click-through. Parked on a condvar while the island is hidden.
pub fn spawn_cursor_poll(app: AppHandle, gate: Arc<PollGate>) {
    std::thread::spawn(move || {
        let mut was_down = false;
        let mut last_screen = None;
        loop {
            gate.wait_until_active();
            let mut last = (f64::MIN, f64::MIN);
            let mut period = 16u64;
            let mut since_screen_check = 0u64;
            while gate.is_active() {
                std::thread::sleep(Duration::from_millis(period));

                // A display plugged, unplugged or rescaled moves the island.
                since_screen_check += period;
                if since_screen_check >= 500 {
                    since_screen_check = 0;
                    let now = screen_key(&app);
                    if now.is_some() && now != last_screen {
                        let first = last_screen.is_none();
                        last_screen = now;
                        if !first {
                            let _ = app.emit_to(WINDOW_LABEL, "screen-changed", ());
                        }
                    }
                }

                if !platform::CURSOR_POLL {
                    period = 500;
                    continue;
                }
                let Some(win) = window(&app) else { continue };
                let Ok(origin) = win.outer_position() else { continue };
                let scale = win.scale_factor().unwrap_or(1.0);
                let Some((cx, cy)) = platform::cursor_physical() else { continue };
                let x = (cx - origin.x as f64) / scale;
                let y = (cy - origin.y as f64) / scale;
                let r = *gate.rect.lock().unwrap();
                let down = platform::left_button_down();

                // Far from the island nothing can happen soon: read the cursor
                // three times less often.
                period = if down || r.distance(x, y) < NEAR { 16 } else { 50 };

                let reshaped = gate.rect_changed.swap(false, Ordering::Relaxed);
                if !reshaped && (x - last.0).abs() < 1.0 && (y - last.1).abs() < 1.0 && down == was_down {
                    continue;
                }
                last = (x, y);

                // Click-through: the window only takes the mouse over the island.
                // While a button is held near it, a dragged file must be able to
                // find the window: WS_EX_TRANSPARENT hides it from OLE.
                let dragging = down && r.contains(x, y, DROP_MARGIN);
                was_down = down;
                let accept = r.contains(x, y, HIT_MARGIN) || dragging;
                if gate.ignoring.load(Ordering::Relaxed) == accept {
                    gate.ignoring.store(!accept, Ordering::Relaxed);
                    let _ = win.set_ignore_cursor_events(!accept);
                }

                let _ = win.emit("cursor", CursorPayload { x, y });
            }
        }
    });
}

/// After the window or the island changed shape, the next tick decides again.
pub fn refresh_click_through(app: &AppHandle, gate: &PollGate) {
    if let Some(win) = window(app) {
        let _ = win.set_ignore_cursor_events(false);
    }
    gate.forget_ignore_state();
}

/// Watches for a full-screen app (game, video, slides) about once a second and
/// tells the page, which hides the island until it is gone.
pub fn spawn_fullscreen_watch(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = false;
        loop {
            std::thread::sleep(Duration::from_millis(1200));
            let now = platform::fullscreen_app_running();
            if now != last {
                last = now;
                let _ = app.emit_to(WINDOW_LABEL, "fullscreen", now);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zoom_is_left_alone_when_the_ratios_agree() {
        assert_eq!(zoom_correction(1.0, 1.0, 1.0), None);
        assert_eq!(zoom_correction(1.0, 1.25, 1.25), None);
        assert_eq!(zoom_correction(1.0, 1.0, 1.01), None);
    }

    #[test]
    fn zoom_makes_up_for_text_scaling() {
        assert_eq!(zoom_correction(1.0, 1.0, 1.25), Some(0.8));
        assert_eq!(zoom_correction(1.0, 1.5, 1.0), Some(1.5));
        assert_eq!(zoom_correction(1.0, f64::NAN, 1.0), None);
        assert_eq!(zoom_correction(1.0, 1.0, -1.0), None);
    }

    #[test]
    fn the_hit_test_includes_its_margin() {
        let r = IslandRect { x: 100.0, y: 0.0, w: 200.0, h: 34.0 };
        assert!(r.contains(150.0, 10.0, 0.0));
        assert!(r.contains(90.0, 40.0, HIT_MARGIN));
        assert!(!r.contains(80.0, 60.0, HIT_MARGIN));
        assert!(!IslandRect::default().contains(0.0, 0.0, HIT_MARGIN));
    }

    #[test]
    fn distance_is_zero_inside_and_grows_outside() {
        let r = IslandRect { x: 100.0, y: 0.0, w: 200.0, h: 34.0 };
        assert_eq!(r.distance(150.0, 10.0), 0.0);
        assert_eq!(r.distance(100.0, 134.0), 100.0);
        assert_eq!(r.distance(400.0, 10.0), 100.0);
    }
}
