export type ExportError =
  | { kind: "missing_dependency"; command: string; purpose: string }
  | { kind: "process_failed"; command: string; exit_code: number | null; summary: string; stderr: string }
  | { kind: "invalid_input"; message: string }
  | { kind: "clipboard_failed"; message: string; detail: string | null }
  | { kind: "io_error"; operation: string; message: string };

export type DependencyHelp = {
  command: string;
  purpose: string;
  verifyCommand: string;
  instructions: { linux: string; windows: string; macos: string };
  links: Array<{ label: string; href: string }>;
};

const dependencyHelpByCommand: Record<string, DependencyHelp> = {
  pdflatex: {
    command: "pdflatex",
    purpose: "将 LaTeX 公式编译为 PDF",
    verifyCommand: "pdflatex --version",
    instructions: {
      linux: "使用系统软件包管理器安装 TeX Live，例如 Debian/Ubuntu 可安装 texlive-latex-base。",
      windows: "安装 TeX Live 或 MiKTeX，并确认其可执行文件目录已加入 PATH。",
      macos: "安装 MacTeX（TeX Live 发行版），然后重新打开应用以读取新的 PATH。",
    },
    links: [
      { label: "TeX Live", href: "https://tug.org/texlive/" },
      { label: "MiKTeX", href: "https://miktex.org/download" },
    ],
  },
  pdf2svg: {
    command: "pdf2svg",
    purpose: "将已生成的 PDF 公式转换为 SVG",
    verifyCommand: "pdf2svg --help",
    instructions: {
      linux: "使用系统软件包管理器安装 pdf2svg，例如 Debian/Ubuntu 可运行 sudo apt install pdf2svg。",
      windows: "通过 MSYS2 的 UCRT64 环境安装 mingw-w64-ucrt-x86_64-pdf2svg，并将其 bin 目录加入 PATH。",
      macos: "安装 Homebrew 后运行 brew install pdf2svg。",
    },
    links: [
      { label: "pdf2svg 上游", href: "https://github.com/dawbarton/pdf2svg" },
      { label: "Homebrew pdf2svg", href: "https://formulae.brew.sh/formula/pdf2svg" },
      {
        label: "MSYS2 pdf2svg",
        href: "https://packages.msys2.org/packages/mingw-w64-ucrt-x86_64-pdf2svg",
      },
    ],
  },
  typst: {
    command: "typst",
    purpose: "编译 Typst 公式",
    verifyCommand: "typst --version",
    instructions: {
      linux: "从 Typst 官方安装页选择适合发行版的安装方式，并将 typst 加入 PATH。",
      windows: "从 Typst 官方安装页下载 Windows 版本，并将 typst.exe 所在目录加入 PATH。",
      macos: "从 Typst 官方安装页下载 macOS 版本，并将 typst 加入 PATH。",
    },
    links: [{ label: "Typst 官方安装说明", href: "https://typst.app/" }],
  },
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function normalizeExportError(error: unknown): ExportError {
  const value = record(error);
  if (!value || typeof value.kind !== "string") {
    return { kind: "io_error", operation: "导出", message: error instanceof Error ? error.message : String(error) };
  }

  const command = string(value.command);
  const purpose = string(value.purpose);
  const message = string(value.message);
  const summary = string(value.summary);
  const stderr = string(value.stderr);
  const operation = string(value.operation);
  const detail = string(value.detail);

  if (value.kind === "missing_dependency" && command !== null && purpose !== null) {
    return { kind: value.kind, command, purpose };
  }
  if (
    value.kind === "process_failed" &&
    command !== null &&
    (typeof value.exit_code === "number" || value.exit_code === null) &&
    summary !== null &&
    stderr !== null
  ) {
    return {
      kind: value.kind,
      command,
      exit_code: value.exit_code,
      summary,
      stderr,
    };
  }
  if (value.kind === "invalid_input" && message !== null) {
    return { kind: value.kind, message };
  }
  if (
    value.kind === "clipboard_failed" &&
    message !== null &&
    (detail !== null || value.detail === null)
  ) {
    return { kind: value.kind, message, detail };
  }
  if (value.kind === "io_error" && operation !== null && message !== null) {
    return { kind: value.kind, operation, message };
  }

  return { kind: "io_error", operation: "导出", message: "收到无法识别的导出错误" };
}

export function exportErrorStatus(error: ExportError): string {
  switch (error.kind) {
    case "missing_dependency":
      return `导出失败：未找到 ${error.command}`;
    case "process_failed":
      return `导出失败：${error.summary}`;
    case "invalid_input":
    case "clipboard_failed":
      return `导出失败：${error.message}`;
    case "io_error":
      return `导出失败：${error.operation}失败`;
  }
}

export function dependencyHelp(command: string): DependencyHelp | null {
  return dependencyHelpByCommand[command] ?? null;
}

export function dependencyHelpForError(error: ExportError): DependencyHelp | null {
  return error.kind === "missing_dependency" ? dependencyHelp(error.command) : null;
}

export function exportErrorDetail(error: ExportError): string | null {
  switch (error.kind) {
    case "process_failed":
      return error.stderr || null;
    case "clipboard_failed":
      return error.detail;
    case "io_error":
      return error.message;
    default:
      return null;
  }
}

export function errorPresentation(error: ExportError): {
  status: string;
  detail: string | null;
  help: DependencyHelp | null;
  showDependencyHelp: boolean;
} {
  const help = dependencyHelpForError(error);
  return {
    status: exportErrorStatus(error),
    detail: exportErrorDetail(error),
    help,
    showDependencyHelp: help !== null,
  };
}
