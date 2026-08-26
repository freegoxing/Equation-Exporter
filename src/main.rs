mod app;

use app::MyApp;

#[cfg(not(target_arch = "wasm32"))]
fn main() -> eframe::Result<()>{
    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "equation-exporter",
        options,
        Box::new(|cc| Ok(Box::new(MyApp::new(cc)))),
    )
}