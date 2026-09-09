import "katex/dist/katex.min.css";
import "./style.css";

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import {
  cancelledExportStatus,
  exportArguments,
  outputFormat,
  type Backend,
  type OutputFormat,
  saveDialogOptions,
} from "./export";
import { inputPlaceholder } from "./input-placeholder";
import {
  errorPresentation,
  normalizeExportError,
  type DependencyHelp,
} from "./export-error";
import { renderPreview } from "./preview";
import {
  clampPreviewZoom,
  formatPreviewZoom,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  PREVIEW_ZOOM_STEP,
  previewScale,
} from "./preview-zoom";
import { renderTypstPreview } from "./typst-preview";

const sourceElement = document.querySelector<HTMLTextAreaElement>("#source");
const backendElement = document.querySelector<HTMLSelectElement>("#backend");
const previewElement = document.querySelector<HTMLElement>("#preview");
const previewZoomOutElement = document.querySelector<HTMLButtonElement>("#preview-zoom-out");
const previewZoomValueElement = document.querySelector<HTMLOutputElement>("#preview-zoom-value");
const previewZoomInElement = document.querySelector<HTMLButtonElement>("#preview-zoom-in");
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
  !backendElement ||
  !previewElement ||
  !previewZoomOutElement ||
  !previewZoomValueElement ||
  !previewZoomInElement ||
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
const backend = backendElement;
const preview = previewElement;
const previewZoomOut = previewZoomOutElement;
const previewZoomValue = previewZoomValueElement;
const previewZoomIn = previewZoomInElement;
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
let previewRequest = 0;
let previewZoom = 100;

function applyPreviewScale(): void {
  preview.style.setProperty("--preview-scale", previewScale(backend.value as Backend, previewZoom));
  previewZoomValue.value = formatPreviewZoom(previewZoom);
  previewZoomOut.disabled = previewZoom <= PREVIEW_ZOOM_MIN;
  previewZoomIn.disabled = previewZoom >= PREVIEW_ZOOM_MAX;
}

function applyInputPlaceholder(): void {
  source.placeholder = inputPlaceholder(backend.value as Backend);
}

function updatePreview(): void {
  const request = ++previewRequest;
  const render = backend.value === "typst" ? renderTypstPreview(source.value) : Promise.resolve(renderPreview(source.value));

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

async function copyEquation(output: OutputFormat): Promise<void> {
  setExportButtonsDisabled(true);
  clearExportError();
  setStatus("正在复制…");

  try {
    await invoke("copy_equation", exportArguments(backend.value as Backend, source.value, output));
    setStatus("已复制");
  } catch (error) {
    showExportError(error);
  } finally {
    setExportButtonsDisabled(false);
  }
}

source.addEventListener("input", updatePreview);
backend.addEventListener("change", () => {
  applyInputPlaceholder();
  applyPreviewScale();
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
  void copyEquation(outputFormat(copyOutput.value));
});

applyInputPlaceholder();
applyPreviewScale();
updatePreview();
