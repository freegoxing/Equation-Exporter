import { describe, expect, it, vi } from "vitest";

import { createCompletionPreviewCache } from "./completion-preview";

describe("createCompletionPreviewCache", () => {
  it("shares an in-flight render and caches its result by backend and source", async () => {
    let resolveLatex: ((value: { html?: string }) => void) | undefined;
    const latex = vi.fn((source: string) => {
      if (source !== "\\frac{a}{b}") return Promise.resolve({ html: "<span>x</span>" });
      return new Promise<{ html?: string }>((resolve) => {
        resolveLatex = resolve;
      });
    });
    const typst = vi.fn(async () => ({ html: "<svg>typst</svg>" }));
    const cache = createCompletionPreviewCache({ latex, typst });

    const first = cache.render("latex", "\\frac{a}{b}");
    const second = cache.render("latex", "\\frac{a}{b}");
    expect(latex).toHaveBeenCalledTimes(1);
    resolveLatex?.({ html: "<span>latex</span>" });
    await expect(Promise.all([first, second])).resolves.toEqual([
      "<span>latex</span>",
      "<span>latex</span>",
    ]);
    await expect(cache.render("latex", "\\frac{a}{b}")).resolves.toBe("<span>latex</span>");
    expect(latex).toHaveBeenCalledTimes(1);

    await expect(cache.render("typst", "\\frac{a}{b}")).resolves.toBe("<svg>typst</svg>");
    await expect(cache.render("latex", "x")).resolves.toBe("<span>x</span>");
    expect(typst).toHaveBeenCalledTimes(1);
    expect(latex).toHaveBeenCalledTimes(2);
  });

  it("returns null when a renderer has no HTML result", async () => {
    const cache = createCompletionPreviewCache({
      latex: async () => ({ error: "invalid formula" }),
      typst: async () => ({ message: "empty" }),
    });

    await expect(cache.render("latex", "bad")).resolves.toBeNull();
    await expect(cache.render("typst", "")).resolves.toBeNull();
  });

  it("converts thrown renderer failures to null", async () => {
    const cache = createCompletionPreviewCache({
      latex: async () => {
        throw new Error("renderer failed");
      },
      typst: async () => ({ html: "<svg />" }),
    });

    await expect(cache.render("latex", "x")).resolves.toBeNull();
    await expect(cache.render("typst", "x")).resolves.toBe("<svg />");
  });
});
