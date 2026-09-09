import { expect, test } from "vitest";

import { cancelledExportStatus, copyFailureStatus, exportArguments, outputFormat, saveDialogOptions } from "./export";

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
