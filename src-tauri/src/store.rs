// What the island keeps between launches — preferences, to-dos, the water log,
// the shelf — as one small JSON file per name in %APPDATA%\Notchy.
//
// The page owns the shape of each document; this side only checks the name and
// writes atomically, so a crash mid-write never leaves a half file behind.

use std::fs;
use std::path::PathBuf;

use serde_json::Value;

use crate::platform;

/// Documents the page may read and write. Anything else is refused, so a name
/// can never walk out of the folder.
const NAMES: &[&str] = &["settings", "todos", "water", "focus", "shelf"];

/// Largest document accepted: the shelf of a busy week stays far below.
const MAX_BYTES: usize = 512 * 1024;

fn path_for(name: &str) -> Option<PathBuf> {
    NAMES
        .contains(&name)
        .then(|| platform::config_dir().join(format!("{name}.json")))
}

pub fn get(name: &str) -> Option<Value> {
    let path = path_for(name)?;
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn set(name: &str, value: &Value) -> Result<(), String> {
    let path = path_for(name).ok_or_else(|| format!("unknown document {name}"))?;
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    if text.len() > MAX_BYTES {
        return Err(format!("{name} is too large"));
    }
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_documents_have_a_path() {
        assert!(path_for("settings").is_some());
        assert!(path_for("todos").is_some());
        assert!(path_for("../secrets").is_none());
        assert!(path_for("settings.json").is_none());
        assert!(path_for("").is_none());
    }
}
