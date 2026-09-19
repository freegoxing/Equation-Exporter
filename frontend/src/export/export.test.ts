import { expect, test } from "vitest";

import {
  cancelledExportStatus,
  copyFailureStatus,
  copyFormat,
  copyOptionsForBackend,
  copyFormatsForBackend,
  selectedCopyFormatForBackend,
  officeFormulaArguments,
  exportArguments,
  outputFormat,
  saveDialogOptions,
} from "./export";

test("accepts the WPS native formula copy format", () => {
  expect(copyFormat("wps-omml")).toBe("wps-omml");
});

test("passes OMML and original LaTeX to the WPS command", () => {
  expect(officeFormulaArguments("<m:oMath/>", "\\frac{a}{b}")).toEqual({
    omml: "<m:oMath/>",
    latex: "\\frac{a}{b}",
  });
});

test("offers WPS native formula only for LaTeX", () => {
  expect(copyFormatsForBackend("latex")).toEqual(["pdf", "svg", "wps-omml"]);
  expect(copyFormatsForBackend("typst")).toEqual(["pdf", "svg"]);
});

test("presents ordered copy choices with the WPS label for LaTeX", () => {
  expect(copyOptionsForBackend("latex")).toEqual([
    { value: "pdf", label: "PDF" },
    { value: "svg", label: "SVG" },
    { value: "wps-omml", label: "Word/WPS 公式" },
  ]);
});

test("preserves compatible copy selections and falls back from WPS to PDF", () => {
  expect(selectedCopyFormatForBackend("typst", "pdf")).toBe("pdf");
  expect(selectedCopyFormatForBackend("typst", "svg")).toBe("svg");
  expect(selectedCopyFormatForBackend("typst", "wps-omml")).toBe("pdf");
  expect(selectedCopyFormatForBackend("latex", "wps-omml")).toBe("wps-omml");
});

test("accepts PDF and SVG selector values", () => {
  expect(outputFormat("pdf")).toBe("pdf");
  expect(outputFormat("svg")).toBe("svg");
});

test("rejects an unsupported selector value", () => {
  expect(() => outputFormat("png")).toThrow("Unsupported output format: png");
});

test("uses the requested format as the default save filename and filter", () => {
  expect(saveDialogOptions("svg")).toEqual({
    defaultPath: "equation.svg",
    filters: [{ name: "SVG", extensions: ["svg"] }],
  });
});

test("uses explicit status text for a cancelled save and a failed copy", () => {
  expect(cancelledExportStatus()).toBe("已取消导出");
  expect(copyFailureStatus()).toBe("复制失败，请使用另存为");
});

test("includes the Typst backend in export arguments", () => {
  expect(exportArguments("typst", "x", "svg")).toEqual({
    backend: "typst",
    source: "x",
    output: "svg",
  });
});
