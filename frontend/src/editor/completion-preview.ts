import type { PreviewResult } from "../preview/preview-engine";

export type CompletionPreviewBackend = "latex" | "typst";

export type CompletionPreviewRenderers = Record<
  CompletionPreviewBackend,
  (source: string) => Promise<PreviewResult>
>;

export function createCompletionPreviewCache(renderers: CompletionPreviewRenderers) {
  const cache = new Map<CompletionPreviewBackend, Map<string, Promise<string | null>>>();

  return {
    render(backend: CompletionPreviewBackend, source: string): Promise<string | null> {
      let backendCache = cache.get(backend);
      if (!backendCache) {
        backendCache = new Map();
        cache.set(backend, backendCache);
      }

      const cached = backendCache.get(source);
      if (cached) return cached;

      let rendering: Promise<PreviewResult>;
      try {
        rendering = renderers[backend](source);
      } catch {
        rendering = Promise.resolve({});
      }
      const rendered = Promise.resolve(rendering)
        .then((result) => result.html ?? null)
        .catch(() => null);
      backendCache.set(source, rendered);
      return rendered;
    },
  };
}
