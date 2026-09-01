#[cfg(not(target_os = "linux"))]
use clipboard_rs::{Clipboard, ClipboardContext};
use equation_exporter::commands::{export_equation, OutputFormat};
use std::{fs, path::{Path, PathBuf}};

pub fn copy_file(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建保存目录：{error}"))?;
    }
    fs::copy(source, destination)
        .map(|_| ())
        .map_err(|error| format!("无法保存文件：{error}"))
}

#[tauri::command]
pub fn save_equation(
    source: String,
    output: OutputFormat,
    destination: PathBuf,
) -> Result<(), String> {
    let artifact = render_artifact(source, output)?;
    copy_file(&artifact, &destination)
}

#[tauri::command]
pub async fn copy_equation(
    window: tauri::WebviewWindow,
    source: String,
    output: OutputFormat,
) -> Result<(), String> {
    let artifact = tauri::async_runtime::spawn_blocking(move || render_artifact(source, output))
        .await
        .map_err(|error| error.to_string())??;

    write_clipboard(&window, &artifact, output).map_err(copy_error)
}

#[cfg(target_os = "linux")]
fn write_clipboard(
    window: &tauri::WebviewWindow,
    artifact: &Path,
    _output: OutputFormat,
) -> Result<(), String> {
    crate::linux_clipboard::copy_file(window, artifact)
}

#[cfg(not(target_os = "linux"))]
fn write_clipboard(
    _window: &tauri::WebviewWindow,
    artifact: &Path,
    output: OutputFormat,
) -> Result<(), String> {
    let clipboard = ClipboardContext::new().map_err(copy_error)?;

    match output {
        OutputFormat::Pdf => clipboard
            .set_files(vec![artifact.display().to_string()])
            .map_err(|error| error.to_string()),
        OutputFormat::Svg => clipboard
            .set_buffer(svg_clipboard_format(), fs::read(artifact).map_err(copy_error)?)
            .map_err(|error| error.to_string()),
    }
}

fn render_artifact(source: String, output: OutputFormat) -> Result<PathBuf, String> {
    export_equation(source, output).map(PathBuf::from)
}

#[cfg(target_os = "macos")]
fn svg_clipboard_format() -> &'static str {
    "public.svg-image"
}

#[cfg(all(not(target_os = "macos"), not(target_os = "linux")))]
fn svg_clipboard_format() -> &'static str {
    "image/svg+xml"
}

fn copy_error(error: impl std::fmt::Display) -> String {
    format!("复制失败，请使用另存为：{error}")
}

#[cfg(test)]
mod tests {
    use super::copy_file;
    #[cfg(not(target_os = "linux"))]
    use super::svg_clipboard_format;
    use std::{env, fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

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
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let directory = env::temp_dir().join(format!("eqexport-save-test-{nonce}"));
        fs::create_dir(&directory).unwrap();
        directory
    }
}
