import "katex/dist/katex.min.css";
import "./style.css";

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import { cancelledExportStatus, copyFailureStatus, type OutputFormat, saveDialogOptions } from "./export";
import { renderPreview } from "./preview";

const sourceElement = document.querySelector<HTMLTextAreaElement>("#source");
const previewElement = document.querySelector<HTMLElement>("#preview");
const statusElement = document.querySelector<HTMLElement>("#status");
const exportButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-action][data-output]"));

if (!sourceElement || !previewElement || !statusElement) {
  throw new Error("Equation Exporter 页面缺少必要元素");
}

const source = sourceElement;
const preview = previewElement;
const status = statusElement;

function updatePreview(): void {
  const result = renderPreview(source.value);
  preview.classList.toggle("preview-error", Boolean(result.error));

  if (result.html) {
    preview.innerHTML = result.html;
  } else {
    preview.textContent = result.error ?? result.message ?? "";
  }
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
    await invoke("save_equation", { source: source.value, output, destination });
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
    await invoke("copy_equation", { source: source.value, output });
    setStatus("已复制");
  } catch {
    setStatus(copyFailureStatus());
  } finally {
    setExportButtonsDisabled(false);
  }
}

source.addEventListener("input", updatePreview);
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

updatePreview();
