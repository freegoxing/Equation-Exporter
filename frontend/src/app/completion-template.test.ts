import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

const markup = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

test("exposes the formula source as an accessible completion combobox", () => {
  expect(markup).toMatch(
    /<textarea[^>]*id="source"[^>]*role="combobox"[^>]*aria-autocomplete="list"[^>]*aria-controls="completions"[^>]*aria-expanded="false"/s,
  );
});

test("provides a labelled completion listbox next to the source", () => {
  expect(markup).toContain(
    '<div id="completions" class="completions" role="listbox" aria-label="公式命令补全" hidden></div>',
  );
});

test("recomputes completions when only the textarea selection changes", () => {
  expect(script).toContain('source.addEventListener("select", showCompletions);');
});
