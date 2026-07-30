use tauri::Manager;

/// Mobile entry point (iOS/Android via Tauri 2.0).
/// On desktop, `main.rs` calls `run()` directly.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // OS notification bridge — used for nudge alerts and event reminders
        .plugin(tauri_plugin_notification::init())
        // Shell-open — allows opening external URLs (e.g. FVSU portal links)
        .plugin(tauri_plugin_shell::init())
        // Auto-updater — checks the update endpoint on launch
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Deep-link — handles c100ops:// protocol for QR check-in and shared links
        .plugin(tauri_plugin_deep_link::init())
        // OS info — surfaced on the About and Diagnostics pages
        .plugin(tauri_plugin_os::init())
        // Process control — used to relaunch the app after an update installs
        .plugin(tauri_plugin_process::init())
        // Save-file dialog — used by the export menu to present a native file picker
        .plugin(tauri_plugin_dialog::init())
        // File-system write — used to write the exported bytes to the chosen path
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Open DevTools automatically in debug builds only
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running C100 Operations application");
}
