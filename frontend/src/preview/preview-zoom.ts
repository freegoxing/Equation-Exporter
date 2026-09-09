import type { Backend } from "../export/export";

export const PREVIEW_ZOOM_MIN = 50;
export const PREVIEW_ZOOM_MAX = 200;
export const PREVIEW_ZOOM_STEP = 10;

export function clampPreviewZoom(percent: number): number {
  const rounded = Math.round(percent / PREVIEW_ZOOM_STEP) * PREVIEW_ZOOM_STEP;
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, rounded));
}

export function previewScale(backend: Backend, percent: number): string {
  const base = backend === "typst" ? 1.6 : 1;
  return String((base * clampPreviewZoom(percent)) / 100);
}

export function formatPreviewZoom(percent: number): string {
  return `${clampPreviewZoom(percent)}%`;
}
