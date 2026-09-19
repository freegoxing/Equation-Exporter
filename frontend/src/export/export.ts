export type OutputFormat = "pdf" | "svg";
export type Backend = "latex" | "typst";
export type CopyFormat = OutputFormat | "wps-omml";
export type CopyOption = { value: CopyFormat; label: string };

export { officeFormulaArguments } from "./omml";

const copyFormatsByBackend: Record<Backend, readonly CopyFormat[]> = {
  latex: ["pdf", "svg", "wps-omml"],
  typst: ["pdf", "svg"],
};

export function outputFormat(value: string): OutputFormat {
  if (value === "pdf" || value === "svg") return value;
  throw new Error(`Unsupported output format: ${value}`);
}

export function copyFormat(value: string): CopyFormat {
  if (value === "pdf" || value === "svg" || value === "wps-omml") return value;
  throw new Error(`Unsupported copy format: ${value}`);
}

export function copyFormatsForBackend(backend: Backend): readonly CopyFormat[] {
  return copyFormatsByBackend[backend];
}

export function copyOptionsForBackend(backend: Backend): CopyOption[] {
  return copyFormatsForBackend(backend).map((format) => ({
    value: format,
    label: format === "wps-omml" ? "Word/WPS 公式" : format.toUpperCase(),
  }));
}

export function selectedCopyFormatForBackend(backend: Backend, selected: CopyFormat): CopyFormat {
  return copyFormatsForBackend(backend).includes(selected) ? selected : "pdf";
}

export function exportArguments(backend: Backend, source: string, output: OutputFormat) {
  return { backend, source, output };
}

export function saveDialogOptions(output: OutputFormat): {
  defaultPath: string;
  filters: Array<{ name: string; extensions: string[] }>;
} {
  return {
    defaultPath: `equation.${output}`,
    filters: [{ name: output.toUpperCase(), extensions: [output] }],
  };
}

export function cancelledExportStatus(): string {
  return "已取消导出";
}

export function copyFailureStatus(): string {
  return "复制失败，请使用另存为";
}
