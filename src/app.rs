mod fonts;
mod latex;

use eframe::egui;

use crate::app::Backend::Latex;
use crate::app::Output::Pdf;

const EDITOR_PANEL_RESIZABLE: bool = true;

fn take_editor_available_width(ui: &mut egui::Ui) {
    ui.take_available_width();
}

fn add_source_editor(ui: &mut egui::Ui, source: &mut String) -> egui::Response {
    let editor_width = ui.available_width();

    ui.add(
        egui::TextEdit::multiline(source)
            .hint_text(r"例如：\frac{a}{b}")
            .desired_rows(16)
            .desired_width(editor_width)
            .code_editor(),
    )
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Backend {
    #[default]
    Latex,
    Typst,
}

impl Backend {
    fn label(self) -> &'static str {
        match self {
            Self::Latex => "LaTeX",
            Self::Typst => "Typst",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Output {
    #[default]
    Pdf,
    Svg,
}

impl Output {
    fn label(self) -> &'static str {
        match self {
            Self::Pdf => "PDF",
            Self::Svg => "SVG",
        }
    }
}

pub struct MyApp {
    pub backend: Backend,
    pub output: Output,
    pub source: String,
}

impl Default for MyApp {
    fn default() -> Self {
        Self {
            backend: Latex,
            output: Pdf,
            source: String::new(),
        }
    }
}

impl MyApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let fonts = fonts::setup_fonts();
        cc.egui_ctx.set_fonts(fonts);

        Self::default()
    }
}

impl eframe::App for MyApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        egui::Panel::top("toolbar").show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.heading("Equation Exporter");
                ui.separator();

                egui::ComboBox::from_label("后端")
                    .selected_text(self.backend.label())
                    .show_ui(ui, |ui| {
                        ui.selectable_value(&mut self.backend, Backend::Latex, "LaTeX");
                        ui.selectable_value(&mut self.backend, Backend::Typst, "Typst");
                    });

                egui::ComboBox::from_label("默认格式")
                    .selected_text(self.output.label())
                    .show_ui(ui, |ui| {
                        ui.selectable_value(&mut self.output, Output::Pdf, "PDF");
                        ui.selectable_value(&mut self.output, Output::Svg, "SVG");
                    });
            });
        });

        egui::Panel::bottom("export_bar").show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label("导出功能将在接入渲染后启用");
                ui.add_enabled(false, egui::Button::new("导出 PDF"));
                ui.add_enabled(false, egui::Button::new("导出 SVG"));
            });
        });

        egui::Panel::left("editor")
            .resizable(EDITOR_PANEL_RESIZABLE)
            .default_size(360.0)
            .show(ui, |ui| {
                take_editor_available_width(ui);
                ui.heading("公式输入");
                ui.label("输入 LaTeX 或 Typst 公式源码");
                add_source_editor(ui, &mut self.source);
            });

        egui::CentralPanel::default().show(ui, |ui| {
            ui.heading("预览");
            ui.separator();
            ui.centered_and_justified(|ui| {
                ui.label("输入公式并等待渲染预览");
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{
        add_source_editor, take_editor_available_width, Backend, MyApp, Output,
        EDITOR_PANEL_RESIZABLE,
    };

    #[test]
    fn defaults_to_latex_pdf_and_an_empty_formula() {
        let app = MyApp::default();

        assert_eq!(app.backend, Backend::Latex);
        assert_eq!(app.output, Output::Pdf);
        assert!(app.source.is_empty());
    }

    #[test]
    fn exposes_both_backend_and_output_options() {
        assert_eq!(Backend::Latex.label(), "LaTeX");
        assert_eq!(Backend::Typst.label(), "Typst");
        assert_eq!(Output::Pdf.label(), "PDF");
        assert_eq!(Output::Svg.label(), "SVG");
    }

    #[test]
    fn allows_resizing_the_editor_and_preview_split() {
        assert!(EDITOR_PANEL_RESIZABLE);
    }

    #[test]
    fn editor_uses_the_available_width_after_expansion() {
        egui::__run_test_ui(|ui| {
            let available_width = ui.available_width();

            take_editor_available_width(ui);

            assert_eq!(ui.min_rect().width(), available_width);
        });
    }

    #[test]
    fn source_editor_fills_the_current_panel_width() {
        egui::__run_test_ui(|ui| {
            let mut source = String::new();
            let available_width = ui.available_width();

            let response = add_source_editor(ui, &mut source);

            assert_eq!(response.rect.width(), available_width);
        });
    }
}
