use crate::{
    commands::OutputFormat,
    error::{AppError, AppResult},
};
use std::{fs, path::Path, process::Command};

const TEMPLATE: &str =
    "#set page(width: auto, height: auto, margin: 0pt{{FILL}})\n\n$ {{EQUATION}} $\n";

pub fn build_typst_source(input: &str, transparent: bool) -> String {
    TEMPLATE
        .replace("{{FILL}}", if transparent { ", fill: none" } else { "" })
        .replace("{{EQUATION}}", input)
}

pub fn render_typst(input: &str, output: OutputFormat, output_dir: &Path) -> AppResult<()> {
    render_typst_with_command(input, output, output_dir, Path::new("typst"))
}

fn render_typst_with_command(
    input: &str,
    output: OutputFormat,
    output_dir: &Path,
    typst: &Path,
) -> AppResult<()> {
    let source_path = output_dir.join("equation.typ");

    write_source(&source_path, input, matches!(output, OutputFormat::Svg))?;
    run_command(output_dir, typst, output.filename())?;
    ensure_output_exists(output_dir, output.filename())
}

fn write_source(source_path: &Path, input: &str, transparent: bool) -> AppResult<()> {
    fs::write(source_path, build_typst_source(input, transparent))
        .map_err(|error| AppError::io("写入 Typst 源文件", error))
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
    use crate::commands::OutputFormat;
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
    fn renders_only_the_requested_pdf_with_typst() {
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

        let output_dir = unique_dir("eqexport-typst-output");
        render_typst_with_command("x", OutputFormat::Pdf, &output_dir, &typst).unwrap();

        assert_eq!(
            fs::read_to_string(output_dir.join("equation.pdf")).unwrap(),
            "equation.pdf"
        );
        assert!(!output_dir.join("equation.svg").exists());
    }

    #[test]
    fn renders_only_the_requested_svg_with_transparent_page() {
        let fixture_dir = unique_dir("eqexport-typst-svg-bin");
        let typst = fixture_dir.join("typst");
        write_executable(
            &typst,
            "#!/bin/sh\n[ \"$3\" = \"equation.svg\" ] || exit 14\ngrep -q 'fill: none' equation.typ || exit 13\nprintf '<svg />' > equation.svg\n",
        );
        let output_dir = unique_dir("eqexport-typst-svg-output");

        render_typst_with_command("x", OutputFormat::Svg, &output_dir, &typst).unwrap();

        assert_eq!(
            fs::read_to_string(output_dir.join("equation.svg")).unwrap(),
            "<svg />"
        );
        assert!(!output_dir.join("equation.pdf").exists());
    }

    #[test]
    fn system_typst_compiles_a_formula_when_available() {
        if Command::new("typst").arg("--version").status().is_err() {
            return;
        }

        let output_dir = unique_dir("eqexport-typst-real-output");
        super::render_typst(
            "integral_0^infinity e^(-x^2) dif x = sqrt(pi) / 2",
            OutputFormat::Svg,
            &output_dir,
        )
        .unwrap();

        assert!(output_dir.join("equation.svg").is_file());
        assert!(!output_dir.join("equation.pdf").exists());
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
