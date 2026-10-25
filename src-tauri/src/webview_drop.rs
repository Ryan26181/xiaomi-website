// Files dropped on the island, taken by WebView2 itself.
//
// Tauri's own drag-drop goes through drop targets wry registers on the
// webview's child windows, and drags from the classic Explorer folder view
// (Downloads, Documents…) never reach them — Coucou found this out the hard
// way (webview_drop.rs there, MIT). So `dragDropEnabled` is off and WebView2
// takes drops the way Edge does: the page accepts the HTML5 drag and hands the
// File objects back with `chrome.webview.postMessageWithAdditionalObjects`
// (src/core/bridge.ts); here they turn back into real paths.

use tauri::{AppHandle, Emitter};
use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2};
use webview2_com::{take_pwstr, WebMessageReceivedEventHandler};
use wv2_core::{Interface, PWSTR};

use crate::island::{self, WINDOW_LABEL};

pub fn install(app: &AppHandle) {
    let Some(win) = island::window(app) else { return };
    let handle = app.clone();
    let result = win.with_webview(move |webview| unsafe {
        let core = match webview.controller().CoreWebView2() {
            Ok(core) => core,
            Err(err) => {
                eprintln!("[notchy] file drop: no webview: {err}");
                return;
            }
        };
        let handler = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            // Tauri's own IPC messages come through here too; they carry no objects.
            let Ok(args) = args.cast::<ICoreWebView2WebMessageReceivedEventArgs2>() else { return Ok(()) };
            let Ok(objects) = args.AdditionalObjects() else { return Ok(()) };
            let mut count = 0u32;
            objects.Count(&mut count)?;
            if count == 0 {
                return Ok(());
            }
            let mut paths = Vec::new();
            for i in 0..count {
                let Ok(file) = objects.GetValueAtIndex(i)?.cast::<ICoreWebView2File>() else { continue };
                let mut path = PWSTR::null();
                file.Path(&mut path)?;
                paths.push(take_pwstr(path));
            }
            let _ = handle.emit_to(WINDOW_LABEL, "file-drop", paths);
            Ok(())
        }));
        let mut token = 0i64;
        if let Err(err) = core.add_WebMessageReceived(&handler, &mut token) {
            eprintln!("[notchy] file drop: cannot listen: {err}");
        }
    });
    if let Err(err) = result {
        eprintln!("[notchy] file drop: {err}");
    }
}
