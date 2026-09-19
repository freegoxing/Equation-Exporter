use crate::app::{latex::render_latex, typst::render_typst};
use crate::error::AppResult;
use std::path::{Path, PathBuf};
use tempfile::{Builder, TempDir};

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

pub struct RenderedArtifact {
    directory: TempDir,
    output: OutputFormat,
}

impl RenderedArtifact {
    pub fn path(&self) -> PathBuf {
        artifact_path(self.directory.path(), self.output)
    }
}

pub fn export_equation(
    backend: Backend,
    source: String,
    output: OutputFormat,
) -> AppResult<RenderedArtifact> {
    let directory = Builder::new()
        .prefix("eqexport-")
        .tempdir()
        .map_err(|error| crate::error::AppError::io("创建导出临时目录", error))?;
    match backend {
        Backend::Latex => render_latex(&source, output, directory.path())?,
        Backend::Typst => render_typst(&source, output, directory.path())?,
    };
    Ok(RenderedArtifact { directory, output })
}

#[cfg(test)]
mod tests {
    use super::{OutputFormat, RenderedArtifact, artifact_path};
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

    #[test]
    fn rendered_artifact_removes_its_directory_when_dropped() {
        let directory = tempfile::Builder::new()
            .prefix("eqexport-")
            .tempdir()
            .unwrap();
        let artifact = RenderedArtifact {
            directory,
            output: OutputFormat::Pdf,
        };
        let path = artifact.path();
        std::fs::write(&path, "pdf").unwrap();

        drop(artifact);

        assert!(!path.exists());
        assert!(!path.parent().unwrap().exists());
    }
}
