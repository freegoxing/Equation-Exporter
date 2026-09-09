import { expect, test } from "vitest";

import { previewMessage, renderLatexPreview, renderWithKatex } from "./latex-preview";

test("reports an empty formula without calling KaTeX", () => {
  expect(previewMessage("")).toBe("输入 LaTeX 公式后将在此处预览");
});

test("keeps KaTeX HTML for an explicit KaTeX preview", async () => {
  await expect(renderLatexPreview("x^2", "katex")).resolves.toMatchObject({
    html: expect.stringContaining("katex"),
  });
});

test("renders an explicit MathJax preview as SVG", async () => {
  await expect(renderLatexPreview("x^2", "mathjax")).resolves.toMatchObject({
    html: expect.stringContaining("<svg"),
  });
});

test("renders a MathJax dynamic-font symbol as SVG", async () => {
  await expect(renderLatexPreview("\\mathbb{A}", "mathjax")).resolves.toMatchObject({
    html: expect.stringContaining("<svg"),
  });
});

test("Auto falls back to MathJax for a Unicode TeX macro", async () => {
  await expect(renderLatexPreview("\\unicode{x1D538}", "auto")).resolves.toMatchObject({
    html: expect.stringContaining("<svg"),
  });
});

test("rejects invalid non-empty KaTeX input so Auto can fall back", async () => {
  await expect(renderWithKatex("\\notARealCommand")).rejects.toThrow();
});

test("returns a preview error when the selected engine cannot render", async () => {
  await expect(renderLatexPreview("\\notARealCommand", "katex")).resolves.toMatchObject({
    error: expect.any(String),
  });
});
