use std::{fmt, io};

#[derive(Debug, serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AppError {
    MissingDependency {
        command: String,
        purpose: String,
    },
    ProcessFailed {
        command: String,
        exit_code: Option<i32>,
        summary: String,
        stderr: String,
    },
    InvalidInput {
        message: String,
    },
    ClipboardFailed {
        message: String,
        detail: Option<String>,
    },
    IoError {
        operation: String,
        message: String,
    },
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn from_start_error(command: &str, purpose: &str, error: io::Error) -> Self {
        if error.kind() == io::ErrorKind::NotFound {
            Self::MissingDependency {
                command: command.to_owned(),
                purpose: purpose.to_owned(),
            }
        } else {
            Self::io(format!("启动 {command}"), error)
        }
    }

    pub fn process_failed(
        command: &str,
        exit_code: Option<i32>,
        summary: impl Into<String>,
        stderr: impl Into<String>,
    ) -> Self {
        Self::ProcessFailed {
            command: command.to_owned(),
            exit_code,
            summary: summary.into(),
            stderr: stderr.into(),
        }
    }

    pub fn io(operation: impl Into<String>, error: impl fmt::Display) -> Self {
        Self::IoError {
            operation: operation.into(),
            message: error.to_string(),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingDependency { command, purpose } => {
                write!(formatter, "未找到 {command}（{purpose}）")
            }
            Self::ProcessFailed { summary, .. }
            | Self::InvalidInput { message: summary }
            | Self::ClipboardFailed {
                message: summary, ..
            } => formatter.write_str(summary),
            Self::IoError { operation, message } => write!(formatter, "{operation}失败：{message}"),
        }
    }
}

impl std::error::Error for AppError {}

#[cfg(test)]
mod tests {
    use super::AppError;
    use std::io;

    #[test]
    fn only_a_not_found_start_error_is_a_missing_dependency() {
        assert!(matches!(
            AppError::from_start_error(
                "pdflatex",
                "编译 LaTeX 公式",
                io::Error::from(io::ErrorKind::NotFound)
            ),
            AppError::MissingDependency { command, .. } if command == "pdflatex"
        ));
        assert!(matches!(
            AppError::from_start_error(
                "pdflatex",
                "编译 LaTeX 公式",
                io::Error::from(io::ErrorKind::PermissionDenied)
            ),
            AppError::IoError { .. }
        ));
    }

    #[test]
    fn a_nonzero_process_result_stays_a_process_failure() {
        assert!(matches!(
            AppError::process_failed(
                "pdflatex",
                Some(1),
                "LaTeX 编译失败",
                "! LaTeX Error: File `x.sty' not found."
            ),
            AppError::ProcessFailed { command, exit_code: Some(1), .. } if command == "pdflatex"
        ));
    }
}
