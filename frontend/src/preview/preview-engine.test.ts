import { expect, test, vi } from "vitest";
import {
  DEFAULT_PREVIEW_ENGINE,
  PREVIEW_ENGINE_STORAGE_KEY,
  readPreviewEngine,
  renderWithPreviewEngine,
  writePreviewEngine,
} from "./preview-engine";

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test("defaults to Auto when no stored mode exists", () => {
  expect(readPreviewEngine(fakeStorage())).toBe(DEFAULT_PREVIEW_ENGINE);
});

test("ignores invalid stored preview modes", () => {
  const storage = fakeStorage();
  storage.setItem(PREVIEW_ENGINE_STORAGE_KEY, "unknown");
  expect(readPreviewEngine(storage)).toBe("auto");
});

test("persists a user-selected preview mode", () => {
  const storage = fakeStorage();
  writePreviewEngine("mathjax", storage);
  expect(storage.getItem(PREVIEW_ENGINE_STORAGE_KEY)).toBe("mathjax");
});

test("Auto returns KaTeX output without calling MathJax", async () => {
  const katex = vi.fn().mockResolvedValue({ html: "<span>fast</span>" });
  const mathjax = vi.fn().mockResolvedValue({ html: "<svg/>" });
  await expect(renderWithPreviewEngine("x", "auto", { katex, mathjax })).resolves.toEqual({ html: "<span>fast</span>" });
  expect(mathjax).not.toHaveBeenCalled();
});

test("Auto calls MathJax only after KaTeX rejects", async () => {
  const katex = vi.fn().mockRejectedValue(new Error("KaTeX parse error"));
  const mathjax = vi.fn().mockResolvedValue({ html: "<svg/>" });
  await expect(renderWithPreviewEngine("\\unsupported", "auto", { katex, mathjax })).resolves.toEqual({ html: "<svg/>" });
  expect(mathjax).toHaveBeenCalledOnce();
});

test("Auto does not fall back for an error result", async () => {
  const katex = vi.fn().mockResolvedValue({ error: "render failed" });
  const mathjax = vi.fn().mockResolvedValue({ html: "<svg/>" });
  await expect(renderWithPreviewEngine("x", "auto", { katex, mathjax })).resolves.toEqual({ error: "render failed" });
  expect(mathjax).not.toHaveBeenCalled();
});

test("explicit KaTeX mode does not call MathJax", async () => {
  const katex = vi.fn().mockResolvedValue({ html: "fast" });
  const mathjax = vi.fn().mockResolvedValue({ html: "compatible" });
  await expect(renderWithPreviewEngine("x", "katex", { katex, mathjax })).resolves.toEqual({ html: "fast" });
  expect(katex).toHaveBeenCalledOnce();
  expect(mathjax).not.toHaveBeenCalled();
});

test("explicit MathJax mode does not call KaTeX", async () => {
  const katex = vi.fn().mockResolvedValue({ html: "fast" });
  const mathjax = vi.fn().mockResolvedValue({ html: "compatible" });
  await expect(renderWithPreviewEngine("x", "mathjax", { katex, mathjax })).resolves.toEqual({ html: "compatible" });
  expect(mathjax).toHaveBeenCalledOnce();
  expect(katex).not.toHaveBeenCalled();
});
