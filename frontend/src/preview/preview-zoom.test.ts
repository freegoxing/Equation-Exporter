import { expect, test } from "vitest";

import { clampPreviewZoom, formatPreviewZoom, previewScale } from "./preview-zoom";

test("bounds preview zoom to the supported range", () => {
  expect(clampPreviewZoom(40)).toBe(50);
  expect(clampPreviewZoom(135)).toBe(140);
  expect(clampPreviewZoom(230)).toBe(200);
});

test("applies each backend baseline before the user zoom", () => {
  expect(previewScale("latex", 100)).toBe("1.25");
  expect(previewScale("latex", 200)).toBe("2.5");
  expect(previewScale("typst", 100)).toBe("2");
  expect(previewScale("typst", 150)).toBe("3");
});

test("formats a zoom percentage for the preview toolbar", () => {
  expect(formatPreviewZoom(120)).toBe("120%");
});
