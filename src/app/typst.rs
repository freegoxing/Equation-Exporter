use std::{
    fmt, fs, io,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicUsize, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const TEMPLATE: &str =
    "#set page(width: auto, height: auto, margin: 0pt{{FILL}})\n\n$ {{EQUATION}} $\n";

static DIRECTORY_COUNTER: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug)]
pub struct TypstRenderError {
    output_dir: PathBuf,
    message: String,
}

impl fmt::Display for TypstRenderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{} (output retained in {})",
            self.message,
            self.output_dir.display()
        )
    }
}

impl std::error::Error for TypstRenderError {}

pub fn build_typst_source(input: &str, transparent: bool) -> String {
    TEMPLATE
        .replace("{{FILL}}", if transparent { ", fill: none" } else { "" })
        .replace("{{EQUATION}}", input)
}

pub fn render_typst(input: &str) -> Result<PathBuf, TypstRenderError> {
    render_typst_with_command(input, Path::new("typst"))
}

fn render_typst_with_command(input: &str, typst: &Path) -> Result<PathBuf, TypstRenderError> {
    let output_dir = create_output_dir()?;
    let source_path = output_dir.join("equation.typ");

    write_source(&source_path, input, false, &output_dir)?;
    run_command(&output_dir, typst, "equation.pdf")?;
    ensure_output_exists(&output_dir, "equation.pdf")?;

    write_source(&source_path, input, true, &output_dir)?;
    run_command(&output_dir, typst, "equation.svg")?;
    ensure_output_exists(&output_dir, "equation.svg")?;

    Ok(output_dir)
}

fn write_source(
    source_path: &Path,
    input: &str,
    transparent: bool,
    output_dir: &Path,
) -> Result<(), TypstRenderError> {
    fs::write(source_path, build_typst_source(input, transparent)).map_err(|error| {
        TypstRenderError {
            output_dir: output_dir.to_path_buf(),
            message: format!("failed to write {}: {error}", source_path.display()),
        }
    })
}

fn create_output_dir() -> Result<PathBuf, TypstRenderError> {
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
                return Err(TypstRenderError {
                    output_dir,
                    message: format!("failed to create output directory: {error}"),
                });
            }
        }
    }

    Err(TypstRenderError {
        output_dir: base.join("eqexport-unavailable"),
        message: "failed to allocate a unique output directory".to_owned(),
    })
}

fn run_command(output_dir: &Path, typst: &Path, output: &str) -> Result<(), TypstRenderError> {
    let program_name = typst.display();
    let result = Command::new(typst)
        .args(["compile", "equation.typ", output])
        .current_dir(output_dir)
        .output()
        .map_err(|error| TypstRenderError {
            output_dir: output_dir.to_path_buf(),
            message: format!("failed to start {program_name}: {error}"),
        })?;

    if result.status.success() {
        return Ok(());
    }

    Err(TypstRenderError {
        output_dir: output_dir.to_path_buf(),
        message: format!(
            "{program_name} exited with {}: {}",
            result.status,
            String::from_utf8_lossy(&result.stderr).trim()
        ),
    })
}

fn ensure_output_exists(output_dir: &Path, filename: &str) -> Result<(), TypstRenderError> {
    if output_dir.join(filename).is_file() {
        Ok(())
    } else {
        Err(TypstRenderError {
            output_dir: output_dir.to_path_buf(),
            message: format!("typst succeeded but did not create {filename}"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{build_typst_source, render_typst_with_command};
    use std::{
        env, fs,
        os::unix::fs::PermissionsExt,
        path::{Path, PathBuf},
        process::Command,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn wraps_a_formula_in_an_auto_sized_math_document() {
        assert_eq!(
            build_typst_source("x / y", false),
            "#set page(width: auto, height: auto, margin: 0pt)\n\n$ x / y $\n"
        );
    }

    #[test]
    fn svg_source_has_a_transparent_page() {
        assert!(build_typst_source("x", true).contains("fill: none"));
    }

    #[test]
    fn renders_pdf_and_svg_with_typst() {
        let fixture_dir = unique_dir("eqexport-typst-test-bin");
        let typst = fixture_dir.join("typst");
        write_executable(
            &typst,
            r#"#!/bin/sh
[ "$1" = "compile" ] || exit 11
[ "$2" = "equation.typ" ] || exit 12
case "$3" in
  equation.pdf) : ;;
  equation.svg) grep -q 'fill: none' equation.typ || exit 13 ;;
  *) exit 14 ;;
esac
printf '%s' "$3" > "$3"
"#,
        );

        let output_dir = render_typst_with_command("x", &typst).unwrap();

        assert_eq!(
            fs::read_to_string(output_dir.join("equation.pdf")).unwrap(),
            "equation.pdf"
        );
        assert_eq!(
            fs::read_to_string(output_dir.join("equation.svg")).unwrap(),
            "equation.svg"
        );
    }

    #[test]
    fn system_typst_compiles_a_formula_when_available() {
        if Command::new("typst").arg("--version").status().is_err() {
            return;
        }

        let output_dir =
            super::render_typst("integral_0^infinity e^(-x^2) dif x = sqrt(pi) / 2").unwrap();

        assert!(output_dir.join("equation.pdf").is_file());
        assert!(output_dir.join("equation.svg").is_file());
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
