import "katex/dist/katex.min.css";
import "./style.css";

import { invoke } from "@tauri-apps/api/core";

import { renderPreview } from "./preview";

const sourceElement = document.querySelector<HTMLTextAreaElement>("#source");
const previewElement = document.querySelector<HTMLElement>("#preview");
const statusElement = document.querySelector<HTMLElement>("#status");
const exportButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-output]"));

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

async function exportEquation(output: "pdf" | "svg"): Promise<void> {
  exportButtons.forEach((button) => {
    button.disabled = true;
  });
  setStatus("正在导出…");

  try {
    const path = await invoke<string>("export_equation", { source: source.value, output });
    setStatus(`导出成功：${path}`);
  } catch (error) {
    setStatus(`导出失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    exportButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

source.addEventListener("input", updatePreview);
exportButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const output = button.dataset.output;
    if (output === "pdf" || output === "svg") {
      void exportEquation(output);
    }
  });
});

updatePreview();
