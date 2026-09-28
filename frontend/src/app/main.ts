import "katex/dist/katex.min.css";
import "./style.css";

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import {
  cancelledExportStatus,
  copyFormat,
  copyOptionsForBackend,
  exportArguments,
  officeFormulaArguments,
  outputFormat,
  selectedCopyFormatForBackend,
  type Backend,
  type CopyFormat,
  type OutputFormat,
  saveDialogOptions,
} from "../export/export";
import { inputPlaceholder } from "../editor/input-placeholder";
import { createTextHistory } from "../editor/text-history";
import {
  applyCompletion,
  findCompletions,
  rebaseRanges,
  type CompletionMatch,
  type TextRange,
} from "../editor/completion";
import { createCompletionPreviewCache } from "../editor/completion-preview";
import {
  errorPresentation,
  normalizeExportError,
  type DependencyHelp,
} from "../export/export-error";
import { renderLatexMathml, renderLatexPreview } from "../preview/latex-preview";
import { mathmlToOmml } from "../export/omml";
import {
  readPreviewEngine,
  writePreviewEngine,
  type PreviewEngine,
} from "../preview/preview-engine";
import {
  clampPreviewZoom,
  formatPreviewZoom,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  PREVIEW_ZOOM_STEP,
  previewScale,
} from "../preview/preview-zoom";
import { renderTypstPreview } from "../preview/typst-preview";

const sourceElement = document.querySelector<HTMLTextAreaElement>("#source");
const editorPaneElement = document.querySelector<HTMLElement>(".editor-pane");
const completionsElement = document.querySelector<HTMLDivElement>("#completions");
const backendElement = document.querySelector<HTMLSelectElement>("#backend");
const previewElement = document.querySelector<HTMLElement>("#preview");
const previewZoomOutElement = document.querySelector<HTMLButtonElement>("#preview-zoom-out");
const previewZoomValueElement = document.querySelector<HTMLOutputElement>("#preview-zoom-value");
const previewZoomInElement = document.querySelector<HTMLButtonElement>("#preview-zoom-in");
const previewEngineElement = document.querySelector<HTMLSelectElement>("#preview-engine");
const previewEngineControlElement = document.querySelector<HTMLElement>(".preview-engine");
const statusElement = document.querySelector<HTMLElement>("#status");
const dependencyHelpToggleElement = document.querySelector<HTMLButtonElement>("#dependency-help-toggle");
const dependencyHelpElement = document.querySelector<HTMLElement>("#dependency-help");
const dependencyHelpContentElement = document.querySelector<HTMLElement>("#dependency-help-content");
const exportErrorDetailElement = document.querySelector<HTMLDetailsElement>("#export-error-detail");
const exportErrorDetailContentElement = document.querySelector<HTMLElement>("#export-error-detail-content");
const saveEquationButtonElement = document.querySelector<HTMLButtonElement>("#save-equation");
const copyEquationButtonElement = document.querySelector<HTMLButtonElement>("#copy-equation");
const saveOutputElement = document.querySelector<HTMLSelectElement>("#save-output");
const copyOutputElement = document.querySelector<HTMLSelectElement>("#copy-output");

if (
  !sourceElement ||
  !editorPaneElement ||
  !completionsElement ||
  !backendElement ||
  !previewElement ||
  !previewZoomOutElement ||
  !previewZoomValueElement ||
  !previewZoomInElement ||
  !previewEngineElement ||
  !previewEngineControlElement ||
  !statusElement ||
  !dependencyHelpToggleElement ||
  !dependencyHelpElement ||
  !dependencyHelpContentElement ||
  !exportErrorDetailElement ||
  !exportErrorDetailContentElement ||
  !saveEquationButtonElement ||
  !copyEquationButtonElement ||
  !saveOutputElement ||
  !copyOutputElement
) {
  throw new Error("Equation Exporter 页面缺少必要元素");
}

const source = sourceElement;
const editorPane = editorPaneElement;
const completions = completionsElement;
const backend = backendElement;
const preview = previewElement;
const previewZoomOut = previewZoomOutElement;
const previewZoomValue = previewZoomValueElement;
const previewZoomIn = previewZoomInElement;
const previewEngine = previewEngineElement;
const previewEngineControl = previewEngineControlElement;
const status = statusElement;
const dependencyHelpToggle = dependencyHelpToggleElement;
const dependencyHelp = dependencyHelpElement;
const dependencyHelpContent = dependencyHelpContentElement;
const exportErrorDetail = exportErrorDetailElement;
const exportErrorDetailContent = exportErrorDetailContentElement;
const saveEquationButton = saveEquationButtonElement;
const copyEquationButton = copyEquationButtonElement;
const saveOutput = saveOutputElement;
const copyOutput = copyOutputElement;
const exportControls = [saveEquationButton, copyEquationButton, saveOutput, copyOutput];
const sourceHistory = createTextHistory(source.value);
let previewRequest = 0;
let previewZoom = 100;
let completionMatches: CompletionMatch[] = [];
let activeCompletion = 0;
let completionRequest = 0;
let snippetRanges: TextRange[] = [];
let pendingInput: { range: TextRange; previousLength: number } | null = null;

const completionPreviewCache = createCompletionPreviewCache({
  latex: (value) => renderLatexPreview(value, "katex"),
  typst: renderTypstPreview,
});

function closeCompletions(): void {
  completionRequest += 1;
  completionMatches = [];
  completions.hidden = true;
  completions.replaceChildren();
  source.setAttribute("aria-expanded", "false");
  source.removeAttribute("aria-activedescendant");
}

function setActiveCompletion(index: number): void {
  if (completionMatches.length === 0) return;
  activeCompletion = (index + completionMatches.length) % completionMatches.length;
  Array.from(completions.children).forEach((node, optionIndex) => {
    node.setAttribute("aria-selected", String(optionIndex === activeCompletion));
  });
  const active = completions.children[activeCompletion] as HTMLElement | undefined;
  if (active) {
    source.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  }
}

function caretCoordinates(): { left: number; top: number; lineHeight: number } {
  const sourceStyle = getComputedStyle(source);
  const sourceRect = source.getBoundingClientRect();
  const paneRect = editorPane.getBoundingClientRect();
  const mirror = document.createElement("div");
  const copiedProperties = [
    "box-sizing", "width", "height", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "font-family", "font-size", "font-style", "font-weight", "letter-spacing", "line-height",
    "text-align", "text-indent", "text-transform", "word-spacing", "tab-size",
  ];
  copiedProperties.forEach((property) => mirror.style.setProperty(property, sourceStyle.getPropertyValue(property)));
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    top: `${sourceRect.top}px`,
    left: `${sourceRect.left}px`,
  });
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(document.createTextNode(source.value.slice(0, source.selectionStart)), marker);
  document.body.append(mirror);
  mirror.scrollTop = source.scrollTop;
  mirror.scrollLeft = source.scrollLeft;
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();
  const lineHeight = Number.parseFloat(sourceStyle.lineHeight) || Number.parseFloat(sourceStyle.fontSize) * 1.2 || 20;
  return {
    left: markerRect.left - paneRect.left,
    top: markerRect.top - paneRect.top,
    lineHeight,
  };
}

function positionCompletionPopup(): void {
  if (completions.hidden) return;
  const caret = caretCoordinates();
  const maxLeft = Math.max(0, editorPane.clientWidth - completions.offsetWidth);
  const below = caret.top + caret.lineHeight + 4;
  const above = caret.top - completions.offsetHeight - 4;
  const top = below + completions.offsetHeight <= editorPane.clientHeight ? below : Math.max(0, above);
  completions.style.left = `${Math.min(Math.max(0, caret.left), maxLeft)}px`;
  completions.style.top = `${top}px`;
}

function renderCompletionOption(match: CompletionMatch, index: number, request: number): HTMLElement {
  const option = document.createElement("div");
  option.id = `completion-option-${request}-${index}`;
  option.className = "completion-item";
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", String(index === activeCompletion));

  const label = document.createElement("span");
  label.className = "completion-label";
  if (match.completion.backend === "latex") label.append("\\");
  const matchedIndices = new Set(match.matchedIndices);
  Array.from(match.completion.name).forEach((character, characterIndex) => {
    if (!matchedIndices.has(characterIndex)) {
      label.append(character);
      return;
    }
    const matched = document.createElement("mark");
    matched.className = "completion-match";
    matched.textContent = character;
    label.append(matched);
  });

  const detail = document.createElement("span");
  detail.className = "completion-detail";
  const previewNode = document.createElement("span");
  previewNode.className = "completion-preview";
  detail.append(previewNode);
  if (match.completion.signature) {
    const signature = document.createElement("span");
    signature.className = "completion-signature";
    signature.textContent = match.completion.signature;
    detail.append(signature);
  }
  option.append(label, detail);
  option.setAttribute("aria-label", `${label.textContent} ${match.completion.display}`);

  option.addEventListener("mousedown", (event) => event.preventDefault());
  option.addEventListener("mousemove", () => setActiveCompletion(index));
  option.addEventListener("click", () => acceptCompletion(index));

  if (match.completion.symbol) {
    previewNode.textContent = match.completion.symbol;
  } else if (match.completion.signature) {
    previewNode.textContent = "…";
    void completionPreviewCache.render(match.completion.backend, match.completion.preview).then((html) => {
      if (request !== completionRequest || !previewNode.isConnected) return;
      if (html) previewNode.innerHTML = html;
      else previewNode.textContent = match.completion.preview;
    });
  } else {
    previewNode.remove();
  }
  return option;
}

function showCompletions(): void {
  const matches = findCompletions(
    backend.value as Backend,
    source.value,
    source.selectionEnd,
    source.selectionStart,
    source.selectionEnd,
  );
  if (matches.length === 0 || document.activeElement !== source) {
    closeCompletions();
    return;
  }

  const request = ++completionRequest;
  completionMatches = matches;
  activeCompletion = 0;
  completions.replaceChildren(...matches.map((match, index) => renderCompletionOption(match, index, request)));
  completions.hidden = false;
  source.setAttribute("aria-expanded", "true");
  setActiveCompletion(0);
  positionCompletionPopup();
}

function acceptCompletion(index: number): void {
  const selected = completionMatches[index];
  if (!selected) return;
  const current = findCompletions(
    backend.value as Backend,
    source.value,
    source.selectionEnd,
    source.selectionStart,
    source.selectionEnd,
  ).find(({ completion }) => completion.name === selected.completion.name);
  if (!current) {
    closeCompletions();
    return;
  }

  const suffixLength = source.value.length - current.range.end;
  const result = applyCompletion(source.value, current);
  source.value = result.value;
  const caret = result.value.length - suffixLength;
  const selection = result.selection ?? { start: caret, end: caret };
  source.setSelectionRange(selection.start, selection.end);
  snippetRanges = result.finalCaret ? [...result.placeholders, result.finalCaret] : [];
  pendingInput = null;
  sourceHistory.record(source.value);
  closeCompletions();
  updatePreview();
  source.focus();
}

function applyPreviewScale(): void {
  preview.style.setProperty("--preview-scale", previewScale(backend.value as Backend, previewZoom));
  previewZoomValue.value = formatPreviewZoom(previewZoom);
  previewZoomOut.disabled = previewZoom <= PREVIEW_ZOOM_MIN;
  previewZoomIn.disabled = previewZoom >= PREVIEW_ZOOM_MAX;
}

function applyInputPlaceholder(): void {
  source.placeholder = inputPlaceholder(backend.value as Backend);
}

function applyPreviewEngine(): void {
  previewEngineControl.hidden = backend.value !== "latex";
}

function updatePreview(): void {
  const request = ++previewRequest;
  const render = backend.value === "typst"
    ? renderTypstPreview(source.value)
    : renderLatexPreview(source.value, previewEngine.value as PreviewEngine);

  void render.then((result) => {
    if (request !== previewRequest) {
      return;
    }

    preview.classList.toggle("preview-error", Boolean(result.error));

    if (result.html) {
      preview.innerHTML = result.html;
    } else {
      preview.textContent = result.error ?? result.message ?? "";
    }

    applyPreviewScale();
  });
}

function applyHistoryValue(value: string | undefined): void {
  if (value === undefined) {
    return;
  }

  source.value = value;
  snippetRanges = [];
  pendingInput = null;
  closeCompletions();
  updatePreview();
}

function setStatus(message: string): void {
  status.textContent = message;
}

function clearExportError(): void {
  dependencyHelpToggle.hidden = true;
  dependencyHelpToggle.setAttribute("aria-expanded", "false");
  dependencyHelp.hidden = true;
  dependencyHelpContent.replaceChildren();
  exportErrorDetail.hidden = true;
  exportErrorDetail.open = false;
  exportErrorDetailContent.textContent = "";
}

function textElement(tag: "h2" | "h3" | "p" | "li" | "code", text: string): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function dependencyHelpNodes(help: DependencyHelp): Node[] {
  const title = textElement("h2", `安装 ${help.command}`);
  const purpose = textElement("p", `用途：${help.purpose}`);
  const platforms = document.createElement("ul");
  platforms.append(
    textElement("li", `Linux：${help.instructions.linux}`),
    textElement("li", `Windows：${help.instructions.windows}`),
    textElement("li", `macOS：${help.instructions.macos}`),
  );
  const verification = document.createElement("p");
  verification.append("安装后在终端运行：", textElement("code", help.verifyCommand));
  const links = document.createElement("p");
  links.append("官方与上游链接：");
  help.links.forEach((link, index) => {
    if (index > 0) links.append(" · ");
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;
    links.append(anchor);
  });
  return [title, purpose, platforms, verification, links];
}

function showExportError(error: unknown): void {
  const normalized = normalizeExportError(error);
  const presentation = errorPresentation(normalized);
  setStatus(presentation.status);

  if (presentation.help) {
    dependencyHelpToggle.hidden = false;
    dependencyHelpContent.replaceChildren(...dependencyHelpNodes(presentation.help));
  }
  if (presentation.detail) {
    exportErrorDetail.hidden = false;
    exportErrorDetailContent.textContent = presentation.detail;
  }
}

function setExportButtonsDisabled(disabled: boolean): void {
  exportControls.forEach((control) => {
    control.disabled = disabled;
  });
}

async function saveEquation(output: OutputFormat): Promise<void> {
  clearExportError();
  const destination = await save(saveDialogOptions(output));
  if (destination === null) {
    setStatus(cancelledExportStatus());
    return;
  }

  setExportButtonsDisabled(true);
  setStatus("正在导出…");

  try {
    await invoke("save_equation", {
      ...exportArguments(backend.value as Backend, source.value, output),
      destination,
    });
    setStatus(`已保存：${destination}`);
  } catch (error) {
    showExportError(error);
  } finally {
    setExportButtonsDisabled(false);
  }
}

async function copyEquation(output: CopyFormat): Promise<void> {
  setExportButtonsDisabled(true);
  clearExportError();
  setStatus("正在复制…");

  try {
    if (output === "wps-omml") {
      const mathml = await renderLatexMathml(source.value);
      const omml = mathmlToOmml(mathml);
      await invoke("copy_wps_formula", officeFormulaArguments(omml, source.value));
    } else {
      await invoke("copy_equation", exportArguments(backend.value as Backend, source.value, output));
    }
    setStatus("已复制");
  } catch (error) {
    showExportError(error);
  } finally {
    setExportButtonsDisabled(false);
  }
}

function syncCopyOutput(backend: Backend): void {
  const selected = copyFormat(copyOutput.value);
  copyOutput.replaceChildren(
    ...copyOptionsForBackend(backend).map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  copyOutput.value = selectedCopyFormatForBackend(backend, selected);
}

source.addEventListener("beforeinput", () => {
  pendingInput = {
    range: { start: source.selectionStart, end: source.selectionEnd },
    previousLength: source.value.length,
  };
});
source.addEventListener("input", () => {
  if (pendingInput && snippetRanges.length > 0) {
    const removedLength = pendingInput.range.end - pendingInput.range.start;
    const insertedLength = source.value.length - (pendingInput.previousLength - removedLength);
    snippetRanges = rebaseRanges(snippetRanges, pendingInput.range, insertedLength) ?? [];
  } else if (!pendingInput) {
    snippetRanges = [];
  }
  pendingInput = null;
  sourceHistory.record(source.value);
  updatePreview();
  showCompletions();
});
source.addEventListener("keydown", (event) => {
  if (completionMatches.length > 0 && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "Escape") closeCompletions();
    else if (event.key === "Enter" || event.key === "Tab") acceptCompletion(activeCompletion);
    else setActiveCompletion(activeCompletion + (event.key === "ArrowDown" ? 1 : -1));
    return;
  }
  if (event.key === "Tab" && snippetRanges.length > 0) {
    event.preventDefault();
    const [next, ...remaining] = snippetRanges;
    snippetRanges = remaining;
    source.setSelectionRange(next.start, next.end);
    closeCompletions();
    return;
  }
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }

  if (event.key.toLowerCase() === "z") {
    event.preventDefault();
    applyHistoryValue(event.shiftKey ? sourceHistory.redo() : sourceHistory.undo());
  } else if (event.key.toLowerCase() === "y") {
    event.preventDefault();
    applyHistoryValue(sourceHistory.redo());
  }
});
source.addEventListener("keyup", (event) => {
  if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
    showCompletions();
  }
});
source.addEventListener("select", showCompletions);
source.addEventListener("click", showCompletions);
source.addEventListener("scroll", positionCompletionPopup);
source.addEventListener("blur", closeCompletions);
editorPane.addEventListener("click", (event) => {
  if (event.target === editorPane) source.focus();
});
backend.addEventListener("change", () => {
  snippetRanges = [];
  pendingInput = null;
  closeCompletions();
  syncCopyOutput(backend.value as Backend);
  applyInputPlaceholder();
  applyPreviewEngine();
  applyPreviewScale();
  updatePreview();
});
previewEngine.addEventListener("change", () => {
  writePreviewEngine(previewEngine.value as PreviewEngine, localStorage);
  applyPreviewEngine();
  updatePreview();
});
dependencyHelpToggle.addEventListener("click", () => {
  dependencyHelp.hidden = !dependencyHelp.hidden;
  dependencyHelpToggle.setAttribute("aria-expanded", String(!dependencyHelp.hidden));
});
previewZoomOut.addEventListener("click", () => {
  previewZoom = clampPreviewZoom(previewZoom - PREVIEW_ZOOM_STEP);
  applyPreviewScale();
});
previewZoomIn.addEventListener("click", () => {
  previewZoom = clampPreviewZoom(previewZoom + PREVIEW_ZOOM_STEP);
  applyPreviewScale();
});
saveEquationButton.addEventListener("click", () => {
  void saveEquation(outputFormat(saveOutput.value));
});
copyEquationButton.addEventListener("click", () => {
  void copyEquation(copyFormat(copyOutput.value));
});

syncCopyOutput(backend.value as Backend);
applyInputPlaceholder();
previewEngine.value = readPreviewEngine(localStorage);
applyPreviewEngine();
applyPreviewScale();
updatePreview();
