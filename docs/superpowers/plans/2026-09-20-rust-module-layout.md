# Rust Module Layout Refactor Implementation Plan

> **For agentic workers:** Use the approved Terra–Luna workflow. Keep architecture and final acceptance with Terra; delegate bounded mechanical edits to Luna.

**Goal:** Make the reusable rendering crate and Tauri adapter responsibilities clear in the Rust file layout without changing application behavior.

**Architecture:** The root crate exposes `export`, `latex`, `typst`, and `error`. `export` owns `Backend`, `OutputFormat`, and artifact lifetime. The Tauri crate exposes its commands from `commands.rs` and retains platform clipboard and WPS modules.

**Tech Stack:** Rust 2024, Tauri 2, Cargo workspace.

## Global Constraints

- Keep Tauri command names, argument names and serialization, errors, output names, clipboard formats, and frontend calls unchanged.
- Do not edit frontend, dependencies, or the user's untracked files.
- Commit only with explicit user authorization; do not perform destructive Git operations.
- A file move alone does not need a new behavior test; run the existing tests and checks.

---

### Task 1: Flatten the rendering crate

**Files:**
- Move: `src/app/latex.rs` to `src/latex.rs`
- Move: `src/app/typst.rs` to `src/typst.rs`
- Move and edit: `src/commands.rs` to `src/export.rs`
- Edit: `src/lib.rs`
- Remove after moving its definition: `src/app/backend.rs`
- Remove after flattening: `src/app.rs`

**Interfaces:**
- Produces: `equation_exporter::export::{Backend, OutputFormat, RenderedArtifact, export_equation}`.

- [x] Move the renderer files and `commands.rs` to their target paths.
- [x] Move `Backend` (including its deserialization test) into `src/export.rs`; change renderer imports to `crate::export::OutputFormat`.
- [x] Replace `src/lib.rs` declarations with:

```rust
pub mod error;
pub mod export;
pub mod latex;
pub mod typst;
```

- [x] Delete the now-empty `app.rs` and `app/backend.rs` module files and update `src/export.rs` imports to `crate::{latex::render_latex, typst::render_typst}`.
- [x] Run `cargo test -p equation-exporter` and `cargo check -p equation-exporter` with exit code 0.

### Task 2: Rename the Tauri command adapter

**Files:**
- Move and edit: `src-tauri/src/export.rs` to `src-tauri/src/commands.rs`
- Edit: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `equation_exporter::export::{Backend, OutputFormat, RenderedArtifact, export_equation}`.
- Produces: unchanged Tauri commands `save_equation`, `copy_equation`, and `copy_wps_formula`.

- [x] Move the adapter file and replace its root-crate import:

```rust
use equation_exporter::export::{Backend, OutputFormat, RenderedArtifact, export_equation};
```

- [x] In `src-tauri/src/lib.rs`, replace `mod export;` with `mod commands;` and all three `export::` registrations with `commands::`.
- [x] Run `cargo fmt --check`, `cargo test --workspace`, `cargo check --workspace`, and `git diff --check` with exit code 0.
- [x] Review `git status --short` and `git diff` to confirm the moves changed paths/imports only and left the user's untracked files untouched.
