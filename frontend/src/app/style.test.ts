import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

const stylesheet = readFileSync(new URL("./style.css", import.meta.url), "utf8");

test("scales preview content while preserving scrolling", () => {
  expect(stylesheet).toContain("--preview-scale");
  expect(stylesheet).toContain("zoom: var(--preview-scale, 1)");
  expect(stylesheet).toMatch(/#preview\s*\{[^}]*overflow: auto/s);
});

test("styles preview-engine controls in the preview toolbar", () => {
  expect(stylesheet).toContain(".preview-engine");
  expect(stylesheet).toContain(".preview-engine[hidden] { display: none; }");
});

test("uses one error-card style for all preview engines", () => {
  expect(stylesheet).toMatch(/#preview\.preview-error\s*\{[^}]*align-content:\s*start[^}]*justify-items:\s*start[^}]*background:\s*#fef2f2/s);
});

test("keeps the completion list hidden until the combobox opens it", () => {
  expect(stylesheet).toMatch(/\.completions\[hidden\]\s*\{[^}]*display:\s*none/s);
  expect(stylesheet).toMatch(/\.completion-item\[aria-selected="true"\]/s);
});

test("keeps completion rows compact and visibly highlights fuzzy matches", () => {
  expect(stylesheet).toMatch(/\.completion-item\s*\{[^}]*min-height:\s*2\.25rem/s);
  expect(stylesheet).toMatch(/\.completion-detail\s*\{[^}]*flex-direction:\s*row/s);
  expect(stylesheet).toMatch(/\.completion-match\s*\{[^}]*background:\s*transparent/s);
});
