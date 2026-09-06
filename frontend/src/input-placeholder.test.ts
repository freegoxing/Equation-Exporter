import { expect, test } from "vitest";

import { inputPlaceholder } from "./input-placeholder";

test("uses a LaTeX example for the LaTeX backend", () => {
  expect(inputPlaceholder("latex")).toBe("例如：\\frac{a}{b}");
});

test("uses a basic division example for the Typst backend", () => {
  expect(inputPlaceholder("typst")).toBe("例如：a / b");
});
