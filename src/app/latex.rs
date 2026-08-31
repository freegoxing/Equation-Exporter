#[cfg(test)]
mod tests {
    use super::render_latex_with_commands;
    use std::{
        env, fs,
        os::unix::fs::PermissionsExt,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    const SOURCE: &str = r"G_{\mathrm{rep}}^{\mathrm{train}}";
    const EXPECTED_TEX: &str = r"\documentclass[border=1pt]{standalone}

\usepackage{amsmath}
\usepackage{amssymb}

\begin{document}
$\displaystyle G_{\mathrm{rep}}^{\mathrm{train}}$
\end{document}
";

    #[test]
    fn renders_source_to_pdf_and_svg() {
        let fixture_dir = unique_dir("eqexport-test-bin");
        write_executable(
            &fixture_dir.join("pdflatex"),
            r#"#!/bin/sh
[ "$1" = "-interaction=nonstopmode" ] || exit 11
[ "$2" = "-halt-on-error" ] || exit 12
[ "$3" = "equation.tex" ] || exit 13
touch equation.aux equation.log equation.pdf
"#,
        );
        write_executable(
            &fixture_dir.join("pdf2svg"),
            r#"#!/bin/sh
[ "$1" = "equation.pdf" ] || exit 21
[ "$2" = "equation.svg" ] || exit 22
[ -f equation.pdf ] || exit 23
printf '<svg />' > equation.svg
"#,
        );

        let output_dir = render_latex_with_commands(
            SOURCE,
            fixture_dir.join("pdflatex").as_path(),
            fixture_dir.join("pdf2svg").as_path(),
        )
        .unwrap();

        assert_eq!(output_dir.parent(), Some(Path::new("/tmp")));
        assert!(
            output_dir
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("eqexport-")
        );
        assert!(output_dir.join("equation.tex").is_file());
        assert!(output_dir.join("equation.aux").is_file());
        assert!(output_dir.join("equation.log").is_file());
        assert!(output_dir.join("equation.pdf").is_file());
        assert!(output_dir.join("equation.svg").is_file());
        assert_eq!(
            fs::read_to_string(output_dir.join("equation.tex")).unwrap(),
            EXPECTED_TEX
        );
        assert_eq!(
            fs::read_to_string(output_dir.join("equation.svg")).unwrap(),
            "<svg />"
        );
    }

    fn unique_dir(prefix: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = env::temp_dir().join(format!("{prefix}-{}-{nonce}", std::process::id()));
        fs::create_dir(&path).unwrap();
        path
    }

    fn write_executable(path: &Path, contents: &str) {
        fs::write(path, contents).unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
    }
}

use std::{
    fmt, fs, io,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicUsize, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const TEMPLATE: &str = r"\documentclass[border=1pt]{standalone}

\usepackage{amsmath}
\usepackage{amssymb}

\begin{document}
$\displaystyle {{EQUATION}}$
\end{document}
";

static DIRECTORY_COUNTER: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug)]
pub struct LatexRenderError {
    output_dir: PathBuf,
    message: String,
}

impl LatexRenderError {
    pub fn output_dir(&self) -> &Path {
        &self.output_dir
    }
}

impl fmt::Display for LatexRenderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{} (output retained in {})",
            self.message,
            self.output_dir.display()
        )
    }
}

impl std::error::Error for LatexRenderError {}

pub fn render_latex(source: &str) -> Result<PathBuf, LatexRenderError> {
    render_latex_with_commands(source, Path::new("pdflatex"), Path::new("pdf2svg"))
}

fn render_latex_with_commands(
    source: &str,
    pdflatex: &Path,
    pdf2svg: &Path,
) -> Result<PathBuf, LatexRenderError> {
    let output_dir = create_output_dir()?;
    let tex_path = output_dir.join("equation.tex");
    let tex = TEMPLATE.replace("{{EQUATION}}", source);
    fs::write(&tex_path, tex).map_err(|error| LatexRenderError {
        output_dir: output_dir.clone(),
        message: format!("failed to write {}: {error}", tex_path.display()),
    })?;

    run_command(
        &output_dir,
        pdflatex,
        ["-interaction=nonstopmode", "-halt-on-error", "equation.tex"],
    )?;
    ensure_output_exists(&output_dir, "equation.pdf", "pdflatex")?;

    run_command(&output_dir, pdf2svg, ["equation.pdf", "equation.svg"])?;
    ensure_output_exists(&output_dir, "equation.svg", "pdf2svg")?;

    Ok(output_dir)
}

fn create_output_dir() -> Result<PathBuf, LatexRenderError> {
    let base = std::env::temp_dir();
    for _ in 0..100 {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let counter = DIRECTORY_COUNTER.fetch_add(1, Ordering::Relaxed);
        let output_dir = base.join(format!("eqexport-{}-{nonce}-{counter}", std::process::id()));
        match fs::create_dir(&output_dir) {
            Ok(()) => return Ok(output_dir),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(LatexRenderError {
                    output_dir,
                    message: format!("failed to create output directory: {error}"),
                });
            }
        }
    }

    Err(LatexRenderError {
        output_dir: base.join("eqexport-unavailable"),
        message: "failed to allocate a unique output directory".to_owned(),
    })
}

fn run_command<const N: usize>(
    output_dir: &Path,
    program: &Path,
    arguments: [&str; N],
) -> Result<(), LatexRenderError> {
    let program_name = program.display();
    let output = Command::new(program)
        .args(arguments)
        .current_dir(output_dir)
        .output()
        .map_err(|error| LatexRenderError {
            output_dir: output_dir.to_path_buf(),
            message: format!("failed to start {program_name}: {error}"),
        })?;

    if output.status.success() {
        return Ok(());
    }

    Err(LatexRenderError {
        output_dir: output_dir.to_path_buf(),
        message: format!(
            "{program_name} exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ),
    })
}

fn ensure_output_exists(
    output_dir: &Path,
    filename: &str,
    program: &'static str,
) -> Result<(), LatexRenderError> {
    if output_dir.join(filename).is_file() {
        Ok(())
    } else {
        Err(LatexRenderError {
            output_dir: output_dir.to_path_buf(),
            message: format!("{program} succeeded but did not create {filename}"),
        })
    }
}
