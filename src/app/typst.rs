use crate::error::{AppError, AppResult};
use std::{
    fs, io,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicUsize, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const TEMPLATE: &str =
    "#set page(width: auto, height: auto, margin: 0pt{{FILL}})\n\n$ {{EQUATION}} $\n";

static DIRECTORY_COUNTER: AtomicUsize = AtomicUsize::new(0);

pub fn build_typst_source(input: &str, transparent: bool) -> String {
    TEMPLATE
        .replace("{{FILL}}", if transparent { ", fill: none" } else { "" })
        .replace("{{EQUATION}}", input)
}

pub fn render_typst(input: &str) -> AppResult<PathBuf> {
    render_typst_with_command(input, Path::new("typst"))
}

fn render_typst_with_command(input: &str, typst: &Path) -> AppResult<PathBuf> {
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
    _output_dir: &Path,
) -> AppResult<()> {
    fs::write(source_path, build_typst_source(input, transparent))
        .map_err(|error| AppError::io("写入 Typst 源文件", error))
}

fn create_output_dir() -> AppResult<PathBuf> {
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
                return Err(AppError::io("创建导出临时目录", error));
            }
        }
    }

    Err(AppError::IoError {
        operation: "创建导出临时目录".to_owned(),
        message: format!("无法在 {} 分配唯一目录", base.display()),
    })
}

fn run_command(output_dir: &Path, typst: &Path, output: &str) -> AppResult<()> {
    let result = Command::new(typst)
        .args(["compile", "equation.typ", output])
        .current_dir(output_dir)
        .output()
        .map_err(|error| AppError::from_start_error("typst", "编译 Typst 公式", error))?;

    if result.status.success() {
        return Ok(());
    }

    Err(AppError::process_failed(
        "typst",
        result.status.code(),
        "Typst 编译失败",
        String::from_utf8_lossy(&result.stderr).trim(),
    ))
}

fn ensure_output_exists(output_dir: &Path, filename: &str) -> AppResult<()> {
    if output_dir.join(filename).is_file() {
        Ok(())
    } else {
        Err(AppError::process_failed(
            "typst",
            None,
            format!("typst 未生成 {filename}"),
            "",
        ))
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
