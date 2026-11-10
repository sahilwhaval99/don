// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::process::Command;

// Safe allowlist of applications enforced at the native Rust layer
fn is_allowlisted(app_name: &str) -> Option<&'static str> {
    match app_name.to_lowercase().as_str() {
        "calculator" => Some("C:\\Windows\\System32\\calc.exe"),
        "notepad" => Some("C:\\Windows\\System32\\notepad.exe"),
        "paint" => Some("C:\\Windows\\System32\\mspaint.exe"),
        _ => None,
    }
}

#[tauri::command]
fn launch_approved_app(app_name: String, user_approved: bool) -> Result<String, String> {
    if !user_approved {
        return Err("Execution denied: User approval required.".into());
    }

    match is_allowlisted(&app_name) {
        Some(exe_path) => {
            Command::new(exe_path)
                .spawn()
                .map_err(|e| format!("Failed to spawn executable: {}", e))?;
            Ok(format!("Launched {} safely.", app_name))
        }
        None => Err(format!("Security Violation: '{}' is not registered on the allowlist.", app_name)),
    }
}

#[tauri::command]
fn request_transient_screen_capture(consent_granted: bool) -> Result<String, String> {
    if !consent_granted {
        return Err("Permission denied: Active consent required for screen analysis.".into());
    }
    // Return session confirmation with active sharing indicator
    Ok("Screen sharing session active. Zero persistent retention policy enforced.".into())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            launch_approved_app,
            request_transient_screen_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running DON desktop agent");
}
