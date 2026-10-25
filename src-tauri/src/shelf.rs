// The file shelf: files dropped on the island wait there until they are
// dragged out again (into Explorer, a chat, an editor…) or opened.
//
// The shelf keeps paths, never copies. The page owns the list (store.rs,
// "shelf"); everything here that opens, reveals or drags a file first checks
// that the path really is on that list, so the page can only ever act on
// files the user put there.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, WebviewWindow};

use crate::{media, platform, store};
#[cfg(windows)]
use {crate::island::WINDOW_LABEL, tauri::Emitter};

/// Images up to this size get a real thumbnail; others get an icon.
const THUMB_LIMIT: u64 = 3 * 1024 * 1024;

/// The picture under the cursor while a file is dragged out.
#[cfg(windows)]
const DRAG_ICON: &[u8] = include_bytes!("../icons/drag.png");

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShelfFile {
    pub path: String,
    pub name: String,
    /// Lower-case extension without the dot; empty for folders.
    pub ext: String,
    pub is_dir: bool,
    pub size: u64,
    pub exists: bool,
    /// A data URL for small images.
    pub thumbnail: Option<String>,
}

fn is_image(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp")
}

pub fn describe(path: &str) -> ShelfFile {
    let p = Path::new(path);
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());
    let meta = std::fs::metadata(p).ok();
    let is_dir = meta.as_ref().is_some_and(|m| m.is_dir());
    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
    let ext = if is_dir {
        String::new()
    } else {
        p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default()
    };
    let thumbnail = (meta.is_some() && !is_dir && is_image(&ext) && size <= THUMB_LIMIT)
        .then(|| std::fs::read(p).ok())
        .flatten()
        .and_then(|bytes| media::data_url(&bytes));
    ShelfFile { path: path.to_string(), name, ext, is_dir, size, exists: meta.is_some(), thumbnail }
}

/// The paths on the shelf, as the page last saved them.
fn shelf_paths() -> Vec<String> {
    let Some(doc) = store::get("shelf") else { return Vec::new() };
    doc.get("items")
        .and_then(|items| items.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("path").and_then(|p| p.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

/// Only an absolute path that is on the shelf and still exists passes.
pub fn checked(path: &str, on_shelf: &[String]) -> Option<PathBuf> {
    let p = PathBuf::from(path);
    if !p.is_absolute() || !on_shelf.iter().any(|s| s == path) || !p.exists() {
        return None;
    }
    Some(p)
}

pub fn open(path: &str) -> bool {
    checked(path, &shelf_paths()).is_some_and(|p| platform::open_path(&p))
}

pub fn reveal(path: &str) -> bool {
    checked(path, &shelf_paths()).is_some_and(|p| platform::reveal_path(&p))
}

#[cfg(windows)]
#[derive(Serialize, Clone)]
struct DragEnd {
    dropped: bool,
    paths: Vec<String>,
}

/// Starts a real OS drag of the files, from the mouse press the page saw. The
/// OS runs the drag loop on the main thread until the files are dropped.
#[cfg(windows)]
pub fn drag_out(app: &AppHandle, window: WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    let on_shelf = shelf_paths();
    let files: Vec<PathBuf> = paths.iter().filter_map(|p| checked(p, &on_shelf)).collect();
    if files.is_empty() {
        return Err("nothing to drag".into());
    }
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let done = handle.clone();
        let result = drag::start_drag(
            &window,
            drag::DragItem::Files(files),
            drag::Image::Raw(DRAG_ICON.to_vec()),
            move |result, _| {
                let dropped = matches!(result, drag::DragResult::Dropped);
                let _ = done.emit_to(WINDOW_LABEL, "shelf-drag-end", DragEnd { dropped, paths: paths.clone() });
            },
            drag::Options::default(),
        );
        if let Err(err) = result {
            eprintln!("[notchy] drag out: {err}");
            let _ = handle.emit_to(WINDOW_LABEL, "shelf-drag-end", DragEnd { dropped: false, paths: Vec::new() });
        }
    })
    .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
pub fn drag_out(_app: &AppHandle, _window: WebviewWindow, _paths: Vec<String>) -> Result<(), String> {
    Err("dragging files out is only available on Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_files_on_the_shelf_pass() {
        let dir = std::env::temp_dir().join(format!("notchy-shelf-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("photo.png");
        std::fs::write(&file, [0x89, b'P', b'N', b'G']).unwrap();
        let path = file.to_string_lossy().to_string();

        assert!(checked(&path, std::slice::from_ref(&path)).is_some());
        // Not on the shelf, relative, or gone: refused.
        assert!(checked(&path, &[]).is_none());
        assert!(checked("photo.png", &["photo.png".into()]).is_none());
        let gone = dir.join("gone.txt").to_string_lossy().to_string();
        assert!(checked(&gone, std::slice::from_ref(&gone)).is_none());

        let info = describe(&path);
        assert_eq!(info.name, "photo.png");
        assert_eq!(info.ext, "png");
        assert!(info.exists && !info.is_dir);
        assert!(info.thumbnail.unwrap().starts_with("data:image/png;base64,"));

        let missing = describe(&gone);
        assert!(!missing.exists);
        assert!(missing.thumbnail.is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
