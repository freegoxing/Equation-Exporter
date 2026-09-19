import { expect, test } from "vitest";

import {
  previewMessage,
  renderLatexMathml,
  renderLatexPreview,
  renderWithKatex,
} from "./latex-preview";

const katexCompatibleCommonTex = [
  "\\begin{bmatrix}a & b\\\\ c & d\\end{bmatrix}",
  "\\cancel{x}",
  "\\color{red}{x}",
  "\\xmapsto{f}",
  "a \\coloneqq b",
  "\\newcommand{\\foo}{x}\\foo",
  "\\text{hello}",
];

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

test("renders an AMS bmatrix with MathJax", async () => {
  await expect(
    renderLatexPreview("\\begin{bmatrix}a & b\\\\ c & d\\end{bmatrix}", "mathjax"),
  ).resolves.toMatchObject({
    html: expect.stringContaining("<svg"),
  });
});

test("renders common KaTeX-compatible TeX with MathJax", async () => {
  for (const source of katexCompatibleCommonTex) {
    await expect(renderWithKatex(source)).resolves.toMatchObject({
      html: expect.stringContaining("katex"),
    });
    await expect(renderLatexPreview(source, "mathjax")).resolves.toMatchObject({
      html: expect.stringContaining("<svg"),
    });
  }
});

test("renders a MathJax dynamic-font symbol as SVG", async () => {
  await expect(renderLatexPreview("\\mathbb{A}", "mathjax")).resolves.toMatchObject({
    html: expect.stringContaining("<svg"),
  });
});

test("reports a MathJax error when Auto fallback cannot parse a Unicode TeX macro", async () => {
  await expect(renderLatexPreview("\\unicode{x1D538}", "auto")).resolves.toMatchObject({
    error: expect.stringContaining("Undefined control sequence \\unicode"),
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

test("returns MathJax parse errors as preview errors instead of error SVGs", async () => {
  await expect(renderLatexPreview("\\fra", "mathjax")).resolves.toMatchObject({
    error: expect.stringContaining("Undefined control sequence \\fra"),
  });
});

test("renders standalone MathML after a labelled preview", async () => {
  await expect(renderLatexPreview("\\label{eq:before}x^2", "mathjax")).resolves.toMatchObject({
    html: expect.stringContaining("<svg"),
  });

  const mathml = await renderLatexMathml("x^2");

  expect(mathml).toMatch(/^<math\b/);
  expect(mathml).toMatch(/<msup\b/);
  expect(mathml).not.toContain("mjx-container");
  expect(mathml).not.toContain("eq:before");
  expect(mathml).toMatch(/<\/math>$/);
});

test("keeps repeated MathML conversions independent of labels", async () => {
  const first = await renderLatexMathml("\\label{eq:first}\\frac{a}{b}");
  const second = await renderLatexMathml("\\label{eq:second}\\sqrt{x}");
  const repeat = await renderLatexMathml("\\label{eq:first}\\frac{a}{b}");

  expect(first).toMatch(/<mfrac\b/);
  expect(second).toMatch(/<msqrt\b/);
  expect(second).not.toContain("eq:first");
  expect(repeat).toBe(first);
});

test("rejects blank and invalid MathML conversion input", async () => {
  await expect(renderLatexMathml("  ")).rejects.toThrow();
  await expect(renderLatexMathml("\\notARealCommand")).rejects.toThrow();
});
