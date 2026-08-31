use crate::app::latex::render_latex;

#[derive(Clone, Copy, Debug, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Pdf,
    Svg,
}

impl OutputFormat {
    pub fn filename(self) -> &'static str {
        match self {
            Self::Pdf => "equation.pdf",
            Self::Svg => "equation.svg",
        }
    }
}

pub fn export_equation(source: String, output: OutputFormat) -> Result<String, String> {
    render_latex(&source)
        .map(|directory| directory.join(output.filename()).display().to_string())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::OutputFormat;

    #[test]
    fn output_format_selects_the_requested_filename() {
        assert_eq!(OutputFormat::Pdf.filename(), "equation.pdf");
        assert_eq!(OutputFormat::Svg.filename(), "equation.svg");
    }
}
