import "katex/dist/katex.min.css";
import "./style.css";

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import {
  cancelledExportStatus,
  copyFailureStatus,
  exportArguments,
  type Backend,
  type OutputFormat,
  saveDialogOptions,
} from "./export";
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
const exportButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-action][data-output]"));

if (
  !sourceElement ||
  !backendElement ||
  !previewElement ||
  !previewZoomOutElement ||
  !previewZoomValueElement ||
  !previewZoomInElement ||
  !statusElement
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
let previewRequest = 0;
let previewZoom = 100;

function applyPreviewScale(): void {
  preview.style.setProperty("--preview-scale", previewScale(backend.value as Backend, previewZoom));
  previewZoomValue.value = formatPreviewZoom(previewZoom);
  previewZoomOut.disabled = previewZoom <= PREVIEW_ZOOM_MIN;
  previewZoomIn.disabled = previewZoom >= PREVIEW_ZOOM_MAX;
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

function setExportButtonsDisabled(disabled: boolean): void {
  exportButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function saveEquation(output: OutputFormat): Promise<void> {
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
    setStatus(`导出失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setExportButtonsDisabled(false);
  }
}

async function copyEquation(output: OutputFormat): Promise<void> {
  setExportButtonsDisabled(true);
  setStatus("正在复制…");

  try {
    await invoke("copy_equation", exportArguments(backend.value as Backend, source.value, output));
    setStatus("已复制");
  } catch {
    setStatus(copyFailureStatus());
  } finally {
    setExportButtonsDisabled(false);
  }
}

source.addEventListener("input", updatePreview);
backend.addEventListener("change", () => {
  applyPreviewScale();
  updatePreview();
});
previewZoomOut.addEventListener("click", () => {
  previewZoom = clampPreviewZoom(previewZoom - PREVIEW_ZOOM_STEP);
  applyPreviewScale();
});
previewZoomIn.addEventListener("click", () => {
  previewZoom = clampPreviewZoom(previewZoom + PREVIEW_ZOOM_STEP);
  applyPreviewScale();
});
exportButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const output = button.dataset.output;
    const action = button.dataset.action;
    if ((output === "pdf" || output === "svg") && action === "save") {
      void saveEquation(output);
    } else if ((output === "pdf" || output === "svg") && action === "copy") {
      void copyEquation(output);
    }
  });
});

applyPreviewScale();
updatePreview();
