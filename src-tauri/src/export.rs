#[cfg(not(target_os = "linux"))]
use clipboard_rs::{Clipboard, ClipboardContext};
use equation_exporter::commands::{Backend, OutputFormat, export_equation};
use equation_exporter::error::{AppError, AppResult};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn copy_file(source: &Path, destination: &Path) -> AppResult<()> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| AppError::io("创建保存目录", error))?;
    }
    fs::copy(source, destination)
        .map(|_| ())
        .map_err(|error| AppError::io("保存文件", error))
}

#[tauri::command]
pub fn save_equation(
    source: String,
    backend: Backend,
    output: OutputFormat,
    destination: PathBuf,
) -> AppResult<()> {
    let artifact = render_artifact(source, backend, output)?;
    copy_file(&artifact, &destination)
}

#[tauri::command]
pub async fn copy_equation(
    window: tauri::WebviewWindow,
    source: String,
    backend: Backend,
    output: OutputFormat,
) -> AppResult<()> {
    let artifact =
        tauri::async_runtime::spawn_blocking(move || render_artifact(source, backend, output))
            .await
            .map_err(|error| AppError::io("执行导出任务", error))??;

    write_clipboard(&window, &artifact, output)
}

#[cfg(target_os = "linux")]
fn write_clipboard(
    window: &tauri::WebviewWindow,
    artifact: &Path,
    _output: OutputFormat,
) -> AppResult<()> {
    crate::linux_clipboard::copy_file(window, artifact).map_err(clipboard_error)
}

#[cfg(not(target_os = "linux"))]
fn write_clipboard(
    _window: &tauri::WebviewWindow,
    artifact: &Path,
    output: OutputFormat,
) -> AppResult<()> {
    let clipboard = ClipboardContext::new().map_err(clipboard_error)?;

    match output {
        OutputFormat::Pdf => clipboard
            .set_files(vec![artifact.display().to_string()])
            .map_err(clipboard_error),
        OutputFormat::Svg => clipboard
            .set_buffer(
                svg_clipboard_format(),
                fs::read(artifact).map_err(|error| AppError::io("读取 SVG 临时文件", error))?,
            )
            .map_err(clipboard_error),
    }
}

fn render_artifact(
    source: String,
    backend: Backend,
    output: OutputFormat,
) -> AppResult<PathBuf> {
    export_equation(backend, source, output).map(PathBuf::from)
}

#[cfg(target_os = "macos")]
fn svg_clipboard_format() -> &'static str {
    "public.svg-image"
}

#[cfg(all(not(target_os = "macos"), not(target_os = "linux")))]
fn svg_clipboard_format() -> &'static str {
    "image/svg+xml"
}

fn clipboard_error(error: impl std::fmt::Display) -> AppError {
    AppError::ClipboardFailed {
        message: "无法写入剪贴板".to_owned(),
        detail: Some(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::copy_file;
    #[cfg(not(target_os = "linux"))]
    use super::svg_clipboard_format;
    use std::{
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn copies_a_rendered_artifact_to_the_selected_destination() {
        let test_directory = unique_test_directory();
        let source = test_directory.join("equation.svg");
        let destination = test_directory.join("nested/equation.svg");
        fs::write(&source, "<svg />").unwrap();

        copy_file(&source, &destination).unwrap();

        assert_eq!(fs::read_to_string(destination).unwrap(), "<svg />");
        fs::remove_dir_all(test_directory).unwrap();
    }

    #[test]
    #[cfg(not(target_os = "linux"))]
    fn selects_the_native_svg_clipboard_format() {
        #[cfg(target_os = "macos")]
        assert_eq!(svg_clipboard_format(), "public.svg-image");
        #[cfg(not(target_os = "macos"))]
        assert_eq!(svg_clipboard_format(), "image/svg+xml");
    }

    fn unique_test_directory() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = env::temp_dir().join(format!("eqexport-save-test-{nonce}"));
        fs::create_dir(&directory).unwrap();
        directory
    }
}
