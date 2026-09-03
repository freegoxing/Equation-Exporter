use crate::app::{latex::render_latex, typst::render_typst};
use std::path::{Path, PathBuf};

pub use crate::app::backend::Backend;

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

fn artifact_path(directory: &Path, output: OutputFormat) -> PathBuf {
    directory.join(output.filename())
}

pub fn export_equation(
    backend: Backend,
    source: String,
    output: OutputFormat,
) -> Result<String, String> {
    let directory = match backend {
        Backend::Latex => render_latex(&source).map_err(|error| error.to_string())?,
        Backend::Typst => render_typst(&source).map_err(|error| error.to_string())?,
    };
    Ok(artifact_path(&directory, output).display().to_string())
}

#[cfg(test)]
mod tests {
    use super::{OutputFormat, artifact_path};
    use std::path::Path;

    #[test]
    fn output_format_selects_the_requested_filename() {
        assert_eq!(OutputFormat::Pdf.filename(), "equation.pdf");
        assert_eq!(OutputFormat::Svg.filename(), "equation.svg");
    }

    #[test]
    fn typst_export_selects_the_requested_svg_path() {
        let directory = Path::new("/tmp/eqexport-test");
        assert_eq!(
            artifact_path(directory, OutputFormat::Svg),
            directory.join("equation.svg")
        );
    }
}
