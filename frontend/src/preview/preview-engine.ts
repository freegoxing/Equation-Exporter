export const PREVIEW_ENGINE_STORAGE_KEY = "equation-exporter.preview-engine";

const previewEngines = ["auto", "katex", "mathjax"] as const;

export type PreviewEngine = (typeof previewEngines)[number];

export const DEFAULT_PREVIEW_ENGINE: PreviewEngine = "auto";

/** The common result shape returned by preview renderers. */
export type PreviewResult = { html?: string; message?: string; error?: string };

type PreviewEngineStorageReader = Pick<Storage, "getItem">;
type PreviewEngineStorageWriter = Pick<Storage, "setItem">;

export type PreviewRenderers = {
  katex: (source: string) => Promise<PreviewResult>;
  mathjax: (source: string) => Promise<PreviewResult>;
};

export function readPreviewEngine(storage: PreviewEngineStorageReader): PreviewEngine {
  const stored = storage.getItem(PREVIEW_ENGINE_STORAGE_KEY);
  return isPreviewEngine(stored) ? stored : DEFAULT_PREVIEW_ENGINE;
}

export function writePreviewEngine(engine: PreviewEngine, storage: PreviewEngineStorageWriter): void {
  storage.setItem(PREVIEW_ENGINE_STORAGE_KEY, engine);
}

export async function renderWithPreviewEngine(
  source: string,
  engine: PreviewEngine,
  renderers: PreviewRenderers,
): Promise<PreviewResult> {
  if (engine === "katex") return renderers.katex(source);
  if (engine === "mathjax") return renderers.mathjax(source);

  try {
    return await renderers.katex(source);
  } catch {
    return renderers.mathjax(source);
  }
}

function isPreviewEngine(value: string | null): value is PreviewEngine {
  return value !== null && previewEngines.includes(value as PreviewEngine);
}
