import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("puts preview engine guidance in the selectable options", () => {
  expect(markup).toContain('<option value="auto">Auto — Fast first, compatible fallback</option>');
  expect(markup).toContain('<option value="katex">KaTeX — Fast</option>');
  expect(markup).toContain('<option value="mathjax">MathJax — Compatible</option>');
  expect(markup).not.toContain('id="preview-engine-detail"');
});
