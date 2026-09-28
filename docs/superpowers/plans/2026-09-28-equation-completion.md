# Equation Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `terra-luna-development` for bounded implementation and verification. Follow test-driven development and do not commit without explicit user authorization.

**Goal:** Add accessible, context-safe LaTeX and Typst formula completion with rendered previews and navigable structure placeholders.

**Architecture:** Keep completion data and text-edit behavior in a pure editor module, with explicit snippet parts producing stable placeholder ranges. Integrate a lightweight popup with the existing textarea, validate the completion context at acceptance time, and memoize rendered candidate previews by backend and source. No language server or editor dependency is introduced.

**Tech Stack:** TypeScript 5.9, DOM APIs, Vitest, KaTeX, existing Typst WASM renderer.

## Global Constraints

- Support both `latex` and `typst` backends.
- Show the textual command, a rendered formula preview, and a short signature for structural completions.
- Do not add runtime dependencies or change Rust/Tauri commands.
- Keep native textarea undo/redo and the existing custom history behavior working.
- Revalidate the query and caret before accepting a completion; stale popup state must never corrupt text.
- Cache preview rendering by backend and preview source.
- Provide keyboard operation with ArrowUp, ArrowDown, Enter, Tab, and Escape, plus accessible combobox/listbox relationships.
- Do not commit changes without explicit authorization.

---

### Task 1: Pure completion and snippet model

**Files:**
- Create: `frontend/src/editor/completion.ts`
- Create: `frontend/src/editor/completion.test.ts`

**Interfaces:**
- Produces `Completion`, `CompletionMatch`, `TextRange`, `findCompletions`, `applyCompletion`, and `rebaseRanges`.
- A completion stores snippet parts as literal strings or `{ placeholder: string }`; `applyCompletion` returns inserted text, the first selection, and remaining placeholder ranges.

- [ ] Write failing tests covering LaTeX prefixes, Typst dotted names, no match inside identifiers, deterministic prefix ordering, structural insertion, and rebasing remaining ranges after edits.
- [ ] Run `pnpm --dir frontend test -- --run src/editor/completion.test.ts` and confirm failure because the module does not exist.
- [ ] Implement the catalog and pure functions with no DOM dependency. Use valid example text such as `\\frac{a}{b}` and `frac(a, b)`; never scan translated labels to infer placeholders.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Cached completion previews

**Files:**
- Create: `frontend/src/editor/completion-preview.ts`
- Create: `frontend/src/editor/completion-preview.test.ts`

**Interfaces:**
- Consumes the existing `PreviewResult` shape.
- Produces `createCompletionPreviewCache(renderers)` with `render(backend, source): Promise<string | null>`.

- [ ] Write failing tests proving repeated requests share one render, LaTeX and Typst keys remain separate, and failed/error results are represented safely.
- [ ] Run the focused test and confirm the expected missing-module failure.
- [ ] Implement promise memoization without injecting untrusted markup sources; only static catalog preview strings reach the renderer.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Textarea popup integration

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/app/main.ts`
- Modify: `frontend/src/app/style.css`
- Create: `frontend/src/app/completion-template.test.ts`

**Interfaces:**
- Consumes Task 1 completion edits and Task 2 preview cache.
- Keeps the existing `updatePreview()` and `sourceHistory` integration unchanged except for recording accepted completions and invalidating snippet state on history restoration.

- [ ] Write failing markup tests for `role="combobox"`, `aria-autocomplete="list"`, `aria-controls="completions"`, and the listbox element.
- [ ] Add the popup markup while preserving label association and blank-pane click-to-focus behavior.
- [ ] Integrate input, selection, click, scroll, blur, and keyboard handling. Re-run `findCompletions` before insertion and close/recompute after caret-only movement.
- [ ] Track edits using `beforeinput` selection snapshots and `rebaseRanges`; invalidate snippet state on undo/redo and backend changes.
- [ ] Position the popup from a temporary textarea mirror so wrapping and scrolling are accounted for, and clamp it inside the editor pane.
- [ ] Render candidates through the cache, assign stable option ids, and update `aria-expanded`, `aria-selected`, and `aria-activedescendant`.
- [ ] Run focused editor/app tests, then `pnpm --dir frontend test -- --run`.
- [ ] Run `pnpm --dir frontend build` and `cargo test --workspace`.

### Task 4: Final acceptance review

**Files:**
- Inspect all files changed by Tasks 1–3.

- [ ] Inspect `git diff --check`, `git diff --stat`, and the full diff for unrelated changes or accidental API changes.
- [ ] Verify the acceptance checklist against the global constraints.
- [ ] Run the complete `pnpm test` command and report exact test counts and any warnings.
