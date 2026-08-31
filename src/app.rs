mod fonts;
mod latex;

use eframe::egui;

use crate::app::Backend::Latex;
use crate::app::Output::Pdf;

#[derive(Default)]
enum Backend{
    #[default]
    Latex,
    Typst
}

#[derive(Default)]
enum Output{
    #[default]
    Pdf,
    Svg
}

pub struct MyApp{
    pub backend: Backend,
    pub output: Output,
}

impl Default for MyApp{
    fn default() -> Self{
        Self{
            backend:Latex,
            output:Pdf,
        }
    }
}

impl MyApp{
    pub fn new(cc:&eframe::CreationContext<'_>) -> Self{
        let fonts = fonts::setup_fonts();
        cc.egui_ctx.set_fonts(fonts);

        let mut app:MyApp = Default::default();

        app
    }
}

impl eframe::App for MyApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        ui.heading("Equation Exporter");
    }
}