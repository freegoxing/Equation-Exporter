import katex from "katex";

export const EMPTY_PREVIEW_MESSAGE = "输入 LaTeX 公式后将在此处预览";

export function previewMessage(source: string): string {
  return source.trim() === "" ? EMPTY_PREVIEW_MESSAGE : "";
}

export function renderPreview(source: string): { html?: string; message?: string; error?: string } {
  const message = previewMessage(source);
  if (message) {
    return { message };
  }

  try {
    return { html: katex.renderToString(source, { displayMode: true, throwOnError: true }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
