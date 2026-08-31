use equation_exporter::commands::{OutputFormat, export_equation as export};
#[cfg(debug_assertions)]
use std::{
    io,
    net::{SocketAddr, TcpStream},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[tauri::command]
fn export_equation(source: String, output: OutputFormat) -> Result<String, String> {
    export(source, output)
}

pub fn run() {
    #[cfg(debug_assertions)]
    let _dev_server = start_dev_server_if_needed()
        .expect("failed to start the Equation Exporter frontend development server");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![export_equation])
        .run(tauri::generate_context!())
        .expect("error while running Equation Exporter");
}

#[cfg(debug_assertions)]
const DEV_SERVER_ADDRESS: &str = "127.0.0.1:1420";

#[cfg(debug_assertions)]
fn is_dev_server_running(address: SocketAddr) -> bool {
    connection_succeeds(address, |address| {
        TcpStream::connect_timeout(&address, Duration::from_millis(100))
    })
}

#[cfg(debug_assertions)]
fn connection_succeeds<T, E>(
    address: SocketAddr,
    connect: impl FnOnce(SocketAddr) -> Result<T, E>,
) -> bool {
    connect(address).is_ok()
}

#[cfg(debug_assertions)]
fn start_dev_server_if_needed() -> io::Result<Option<DevServer>> {
    let address = DEV_SERVER_ADDRESS
        .parse()
        .expect("valid development server address");
    if is_dev_server_running(address) {
        return Ok(None);
    }

    let frontend_directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a project root")
        .join("frontend");
    let mut child = Command::new("pnpm")
        .args([
            "--dir",
            frontend_directory.to_str().expect("UTF-8 frontend path"),
            "dev",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    let deadline = Instant::now() + Duration::from_secs(10);

    while Instant::now() < deadline {
        if is_dev_server_running(address) {
            return Ok(Some(DevServer(child)));
        }
        if let Some(status) = child.try_wait()? {
            return Err(io::Error::other(format!("pnpm dev exited with {status}")));
        }
        thread::sleep(Duration::from_millis(100));
    }

    let _ = child.kill();
    Err(io::Error::new(
        io::ErrorKind::TimedOut,
        "pnpm dev did not start listening on 127.0.0.1:1420 within 10 seconds",
    ))
}

#[cfg(debug_assertions)]
struct DevServer(Child);

#[cfg(debug_assertions)]
impl Drop for DevServer {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[cfg(test)]
mod tests {
    use super::connection_succeeds;
    use std::net::SocketAddr;

    #[test]
    fn treats_a_successful_connection_as_a_running_development_server() {
        let address: SocketAddr = "127.0.0.1:1420".parse().unwrap();

        assert!(connection_succeeds(address, |_| Ok::<(), ()>(())));
    }
}
