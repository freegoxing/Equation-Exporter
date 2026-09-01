export type OutputFormat = "pdf" | "svg";

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
