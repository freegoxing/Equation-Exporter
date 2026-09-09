import { expect, test } from "vitest";

import { previewMessage } from "./latex-preview";

test("reports an empty formula without calling KaTeX", () => {
  expect(previewMessage("")).toBe("输入 LaTeX 公式后将在此处预览");
});
