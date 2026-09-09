import { expect, test } from "vitest";

import {
  dependencyHelp,
  dependencyHelpForError,
  errorPresentation,
  exportErrorStatus,
  normalizeExportError,
} from "./export-error";

test("normalizes a missing dependency rejection", () => {
  expect(
    normalizeExportError({
      kind: "missing_dependency",
      command: "pdf2svg",
      purpose: "将 PDF 公式转换为 SVG",
    }),
  ).toMatchObject({ kind: "missing_dependency", command: "pdf2svg" });
});

test("provides the pdf2svg verification command", () => {
  expect(dependencyHelp("pdf2svg")?.verifyCommand).toBe("pdf2svg --help");
});

test("does not infer dependency help from process stderr", () => {
  const error = {
    kind: "process_failed" as const,
    command: "pdflatex",
    exit_code: 1,
    summary: "LaTeX 编译失败",
    stderr: "not found",
  };

  expect(exportErrorStatus(error)).toBe("导出失败：LaTeX 编译失败");
  expect(dependencyHelpForError(error)).toBeNull();
});

test("keeps a process failure with an empty stderr structured", () => {
  expect(
    normalizeExportError({
      kind: "process_failed",
      command: "pdf2svg",
      exit_code: null,
      summary: "pdf2svg 未生成 equation.svg",
      stderr: "",
    }),
  ).toMatchObject({ kind: "process_failed", stderr: "" });
});

test("shows dependency help only for structured missing dependencies", () => {
  expect(
    errorPresentation({
      kind: "missing_dependency",
      command: "pdf2svg",
      purpose: "将 PDF 公式转换为 SVG",
    }).showDependencyHelp,
  ).toBe(true);
  expect(
    errorPresentation({
      kind: "process_failed",
      command: "pdflatex",
      exit_code: 1,
      summary: "LaTeX 编译失败",
      stderr: "not found",
    }).showDependencyHelp,
  ).toBe(false);
  expect(
    errorPresentation({
      kind: "clipboard_failed",
      message: "无法写入剪贴板",
      detail: "selection owner lost",
    }).detail,
  ).toBe("selection owner lost");
});
