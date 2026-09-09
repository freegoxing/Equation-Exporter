import type { PreviewResult } from "./latex-preview";
import mathFontUrl from "../../../fonts/NewCMMath-Regular.otf?url";
import textFontUrl from "../../../fonts/NotoSans-Regular.ttf?url";

let typstRenderer: Promise<{ svg: (options: { mainContent: string }) => Promise<string> }> | undefined;

export const localTypstFontUrls = [textFontUrl, mathFontUrl];

export async function loadLocalTypstFonts(
  loadAsset: (url: string) => Promise<ArrayBuffer> = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`无法加载 Typst 字体：${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
  },
): Promise<Uint8Array[]> {
  return Promise.all(localTypstFontUrls.map(async (url) => new Uint8Array(await loadAsset(url))));
}

export async function createLocalTypstFontProvider<T>(
  preloadFonts: (fonts: Uint8Array[]) => T,
  loadFonts: () => Promise<Uint8Array[]> = loadLocalTypstFonts,
): Promise<T> {
  return preloadFonts(await loadFonts());
}

export function buildTypstPreviewSource(source: string): string {
  return `#set page(width: auto, height: auto, margin: 0pt)\n\n$ ${source} $\n`;
}

export async function renderTypstPreview(source: string): Promise<PreviewResult> {
  if (source.trim() === "") {
    return { message: "输入 Typst 公式后将在此处预览" };
  }

  try {
    const typst = await getTypstRenderer();
    return { html: await typst.svg({ mainContent: buildTypstPreviewSource(source) }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function getTypstRenderer(): Promise<{ svg: (options: { mainContent: string }) => Promise<string> }> {
  typstRenderer ??= (async () => {
    const [{ $typst, TypstSnippet }, { default: compilerWasm }, { default: rendererWasm }] = await Promise.all([
      import("@myriaddreamin/typst.ts/contrib/snippet"),
      import("@myriaddreamin/typst-ts-web-compiler/wasm?url"),
      import("@myriaddreamin/typst-ts-renderer/wasm?url"),
    ]);
    $typst.use(await createLocalTypstFontProvider(TypstSnippet.preloadFonts));
    $typst.use(TypstSnippet.preloadFontAssets({ assets: false }));
    $typst.setCompilerInitOptions({ getModule: () => compilerWasm });
    $typst.setRendererInitOptions({ getModule: () => rendererWasm });
    return $typst;
  })();
  return typstRenderer;
}
