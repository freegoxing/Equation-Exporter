use crate::{
    commands::OutputFormat,
    error::{AppError, AppResult},
};
use std::{fs, path::Path, process::Command};

const TEMPLATE: &str = r"\documentclass[border=1pt]{standalone}

\usepackage{amsmath}
\usepackage{amssymb}

\begin{document}
$\displaystyle {{EQUATION}}$
\end{document}
";

pub fn render_latex(source: &str, output: OutputFormat, output_dir: &Path) -> AppResult<()> {
    render_latex_with_commands(
        source,
        output,
        output_dir,
        Path::new("pdflatex"),
        Path::new("pdf2svg"),
    )
}

fn render_latex_with_commands(
    source: &str,
    output: OutputFormat,
    output_dir: &Path,
    pdflatex: &Path,
    pdf2svg: &Path,
) -> AppResult<()> {
    let tex_path = output_dir.join("equation.tex");
    let tex = TEMPLATE.replace("{{EQUATION}}", source);
    fs::write(&tex_path, tex).map_err(|error| AppError::io("写入 LaTeX 源文件", error))?;

    run_command(
        output_dir,
        pdflatex,
        "pdflatex",
        "编译 LaTeX 公式",
        ["-interaction=nonstopmode", "-halt-on-error", "equation.tex"],
    )?;
    ensure_output_exists(output_dir, "equation.pdf", "pdflatex")?;

    if matches!(output, OutputFormat::Svg) {
        run_command(
            output_dir,
            pdf2svg,
            "pdf2svg",
            "将 PDF 公式转换为 SVG",
            ["equation.pdf", "equation.svg"],
        )?;
        ensure_output_exists(output_dir, "equation.svg", "pdf2svg")?;
    }

    Ok(())
}

fn run_command<const N: usize>(
    output_dir: &Path,
    program: &Path,
    command: &str,
    purpose: &str,
    arguments: [&str; N],
) -> AppResult<()> {
    let output = Command::new(program)
        .args(arguments)
        .current_dir(output_dir)
        .output()
        .map_err(|error| AppError::from_start_error(command, purpose, error))?;

    if output.status.success() {
        return Ok(());
    }

    Err(AppError::process_failed(
        command,
        output.status.code(),
        format!("{command} 执行失败"),
        String::from_utf8_lossy(&output.stderr).trim(),
    ))
}

fn ensure_output_exists(output_dir: &Path, filename: &str, program: &'static str) -> AppResult<()> {
    if output_dir.join(filename).is_file() {
        Ok(())
    } else {
        Err(AppError::process_failed(
            program,
            None,
            format!("{program} 未生成 {filename}"),
            "",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::render_latex_with_commands;
    use crate::commands::OutputFormat;
    use crate::error::AppError;
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

        let output_dir = unique_dir("eqexport-latex-output");
        render_latex_with_commands(
            SOURCE,
            OutputFormat::Svg,
            &output_dir,
            fixture_dir.join("pdflatex").as_path(),
            fixture_dir.join("pdf2svg").as_path(),
        )
        .unwrap();

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

    #[test]
    fn failed_pdf2svg_process_is_not_a_missing_dependency() {
        let fixture_dir = unique_dir("eqexport-failing-pdf2svg");
        let pdflatex = fixture_dir.join("pdflatex");
        let pdf2svg = fixture_dir.join("pdf2svg");
        write_executable(&pdflatex, "#!/bin/sh\ntouch equation.pdf\n");
        write_executable(
            &pdf2svg,
            "#!/bin/sh\nprintf 'pdf2svg: command not found' >&2\nexit 127\n",
        );

        let output_dir = unique_dir("eqexport-latex-output");
        let error =
            render_latex_with_commands(SOURCE, OutputFormat::Svg, &output_dir, &pdflatex, &pdf2svg)
                .unwrap_err();

        assert!(matches!(
            error,
            AppError::ProcessFailed { command, exit_code: Some(127), stderr, .. }
                if command == "pdf2svg" && stderr == "pdf2svg: command not found"
        ));
    }

    #[test]
    fn pdf_export_does_not_require_pdf2svg() {
        let fixture_dir = unique_dir("eqexport-pdf-only");
        let pdflatex = fixture_dir.join("pdflatex");
        write_executable(&pdflatex, "#!/bin/sh\ntouch equation.pdf\n");

        let result = render_latex_with_commands(
            SOURCE,
            OutputFormat::Pdf,
            &unique_dir("eqexport-pdf-output"),
            &pdflatex,
            &fixture_dir.join("missing-pdf2svg"),
        );

        assert!(result.is_ok(), "PDF rendering must not start pdf2svg");
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
