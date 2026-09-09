import katex from "katex";
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

import {
  renderWithPreviewEngine,
  type PreviewEngine,
  type PreviewResult,
} from "./preview-engine";

export type { PreviewResult } from "./preview-engine";

export const EMPTY_PREVIEW_MESSAGE = "输入 LaTeX 公式后将在此处预览";

const mathJaxDynamicFontModules = import.meta.glob(
  "./../../node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js",
);
const mathJaxAdaptor = liteAdaptor();
RegisterHTMLHandler(mathJaxAdaptor);
mathjax.asyncLoad = async (name: string) => {
  if (name.startsWith("@mathjax/mathjax-newcm-font/js/svg/dynamic/")) {
    const filename = name.slice("@mathjax/mathjax-newcm-font/js/svg/dynamic/".length);
    const module = Object.entries(mathJaxDynamicFontModules).find(([path]) => path.endsWith(`/${filename}`))?.[1];
    if (module) {
      return module();
    }
  }
  throw new Error(`MathJax requested an unbundled module: ${name}`);
};
const mathJaxDocument = mathjax.document("", {
  InputJax: new TeX(),
  OutputJax: new SVG({ font: new MathJaxNewcmFont(), fontCache: "local" }),
});

export function previewMessage(source: string): string {
  return source.trim() === "" ? EMPTY_PREVIEW_MESSAGE : "";
}

export function renderPreview(source: string): PreviewResult {
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

export async function renderWithKatex(source: string): Promise<PreviewResult> {
  const message = previewMessage(source);
  if (message) {
    return { message };
  }

  return { html: katex.renderToString(source, { displayMode: true, throwOnError: true }) };
}

export async function renderWithMathJax(source: string): Promise<PreviewResult> {
  const message = previewMessage(source);
  if (message) {
    return { message };
  }

  const node = await mathJaxDocument.convertPromise(source, { display: true });
  return { html: mathJaxAdaptor.outerHTML(node) };
}

export async function renderLatexPreview(source: string, engine: PreviewEngine): Promise<PreviewResult> {
  try {
    return await renderWithPreviewEngine(source, engine, {
      katex: renderWithKatex,
      mathjax: renderWithMathJax,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
