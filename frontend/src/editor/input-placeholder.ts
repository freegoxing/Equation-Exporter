import type { Backend } from "../export/export";

const placeholders: Record<Backend, string> = {
  latex: "例如：\\frac{a}{b}",
  typst: "例如：a / b",
};

export function inputPlaceholder(backend: Backend): string {
  return placeholders[backend];
}
