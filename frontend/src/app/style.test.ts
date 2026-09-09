import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

const stylesheet = readFileSync(new URL("./style.css", import.meta.url), "utf8");

test("scales preview content while preserving scrolling", () => {
  expect(stylesheet).toContain("--preview-scale");
  expect(stylesheet).toContain("zoom: var(--preview-scale, 1)");
  expect(stylesheet).toMatch(/#preview\s*\{[^}]*overflow: auto/s);
});
