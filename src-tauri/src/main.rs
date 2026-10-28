// Decide for Windows: a small window around the live Decide site.
// It uses the browser engine already built into Windows (WebView2), so the installer stays tiny.
// Updates to the site show up here automatically, so this rarely needs a new installer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const SITE: &str = "https://decide-app-531e1.web.app/";
// Pages allowed inside the app; everything else opens in the normal browser.
const ALLOWED_HOSTS: [&str; 2] = ["decide-app-531e1.web.app", "decide-app-531e1.firebaseapp.com"];

fn main() {
    tauri::Builder::default()
        // Opening Decide again focuses the window that's already open.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        // Remembers window size and position.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let url = SITE.parse().expect("valid url");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Decide")
                .inner_size(1280.0, 820.0)
                .min_inner_size(380.0, 560.0)
                .center()
                .initialization_script("window.__DECIDE_DESKTOP__ = true;")
                .on_navigation(|url| {
                    let inside = matches!(url.scheme(), "about" | "data" | "blob")
                        || url.host_str().map_or(false, |h| ALLOWED_HOSTS.contains(&h));
                    if !inside && matches!(url.scheme(), "http" | "https" | "mailto") {
                        let _ = open::that(url.as_str());
                    }
                    inside
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Decide");
}
