import { expect, test } from "vitest";

import {
  buildTypstPreviewSource,
  createLocalTypstFontProvider,
  loadLocalTypstFonts,
  localTypstFontUrls,
} from "./typst-preview";

test("wraps a Typst formula for the preview compiler", () => {
  expect(buildTypstPreviewSource("sum_(k=1)^n k")).toBe(
    "#set page(width: auto, height: auto, margin: 0pt)\n\n$ sum_(k=1)^n k $\n",
  );
});

test("registers local text and math fonts for Typst", () => {
  expect(localTypstFontUrls).toHaveLength(2);
  expect(localTypstFontUrls[1]).toContain("NewCMMath-Regular");
});

test("loads both local Typst fonts as binary data", async () => {
  const fonts = await loadLocalTypstFonts(async () => new Uint8Array([1, 2, 3]).buffer);
  expect(fonts).toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])]);
});

test("creates the local font provider before Typst registers it", async () => {
  const provider = { key: "local-fonts" };
  const preloadFonts = (fonts: Uint8Array[]) => {
    expect(fonts).toHaveLength(2);
    return provider;
  };

  await expect(
    createLocalTypstFontProvider(preloadFonts, async () => [new Uint8Array([1]), new Uint8Array([2])]),
  ).resolves.toBe(provider);
});
