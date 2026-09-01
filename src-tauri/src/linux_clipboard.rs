use gtk::{gdk, TargetEntry, TargetFlags};
use std::{path::Path, sync::mpsc};
use url::Url;

const URI_LIST_MIME: &str = "text/uri-list";
const GNOME_COPY_MIME: &str = "x-special/gnome-copied-files";

pub fn file_uri(path: &Path) -> Result<String, String> {
    if !path.is_absolute() {
        return Err("剪贴板文件路径必须是绝对路径".to_owned());
    }
    Url::from_file_path(path)
        .map(String::from)
        .map_err(|()| "无法生成文件 URI".to_owned())
}

pub fn gnome_copy_payload(uri: &str) -> Vec<u8> {
    format!("copy\n{uri}").into_bytes()
}

pub fn file_copy_targets() -> [&'static str; 2] {
    [URI_LIST_MIME, GNOME_COPY_MIME]
}

pub fn copy_file(window: &tauri::WebviewWindow, path: &Path) -> Result<(), String> {
    let uri = file_uri(path)?;
    let uri_list = format!("{uri}\r\n").into_bytes();
    let gnome_payload = gnome_copy_payload(&uri);

    run_on_gtk_main_thread(window, move || {
        let clipboard = gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD);
        let targets = file_copy_targets().map(|mime| TargetEntry::new(mime, TargetFlags::empty(), 0));
        let acquired = clipboard.set_with_data(&targets, move |_, selection, info| {
            let (mime, data) = if info == 0 {
                (URI_LIST_MIME, uri_list.as_slice())
            } else {
                (GNOME_COPY_MIME, gnome_payload.as_slice())
            };
            selection.set(&gdk::Atom::intern(mime), 8, data);
        });
        acquired
            .then_some(())
            .ok_or_else(|| "GTK 未能取得剪贴板所有权".to_owned())
    })
}

fn run_on_gtk_main_thread(
    window: &tauri::WebviewWindow,
    operation: impl FnOnce() -> Result<(), String> + Send + 'static,
) -> Result<(), String> {
    let (sender, receiver) = mpsc::sync_channel(1);
    window
        .run_on_main_thread(move || {
            let _ = sender.send(operation());
        })
        .map_err(|error| format!("无法切换到 GTK 主线程：{error}"))?;
    receiver
        .recv()
        .map_err(|error| format!("GTK 剪贴板操作未执行：{error}"))?
}

#[cfg(test)]
mod tests {
    use super::{file_copy_targets, file_uri, gnome_copy_payload};
    use std::path::Path;

    #[test]
    fn encodes_an_absolute_path_as_a_file_uri() {
        assert_eq!(
            file_uri(Path::new("/tmp/equation with spaces.pdf")).unwrap(),
            "file:///tmp/equation%20with%20spaces.pdf"
        );
    }

    #[test]
    fn creates_the_gnome_file_copy_payload() {
        assert_eq!(
            gnome_copy_payload("file:///tmp/equation.pdf"),
            b"copy\nfile:///tmp/equation.pdf"
        );
    }

    #[test]
    fn file_copy_targets_include_standard_and_gnome_file_targets() {
        assert_eq!(
            file_copy_targets(),
            ["text/uri-list", "x-special/gnome-copied-files"]
        );
    }

    #[test]
    fn svg_file_copy_uses_the_same_targets_as_pdf_file_copy() {
        assert_eq!(
            file_copy_targets(),
            ["text/uri-list", "x-special/gnome-copied-files"]
        );
    }
}
