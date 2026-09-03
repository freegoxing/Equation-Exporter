#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    equation_exporter_tauri::run();
}
