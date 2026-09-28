export type TextRange = { start: number; end: number };

export type CompletionBackend = 'latex' | 'typst';

export type SnippetPart = string | { placeholder: string };

export type Completion = {
  backend: CompletionBackend;
  name: string;
  display: string;
  preview: string;
  signature?: string;
  parts: SnippetPart[];
};

export type CompletionMatch = {
  completion: Completion;
  query: string;
  range: TextRange;
};

export type AppliedCompletion = {
  value: string;
  selection: TextRange | null;
  placeholders: TextRange[];
  finalCaret: TextRange | null;
};

const latexCompletions: Completion[] = [
  { backend: 'latex', name: 'alpha', display: 'α alpha', preview: '\\alpha', parts: ['\\alpha'] },
  { backend: 'latex', name: 'approx', display: '≈ approximate', preview: '\\approx', parts: ['\\approx'] },
  { backend: 'latex', name: 'beta', display: 'β beta', preview: '\\beta', parts: ['\\beta'] },
  { backend: 'latex', name: 'cdot', display: '⋅ centered dot', preview: 'a\\cdot b', parts: ['\\cdot'] },
  { backend: 'latex', name: 'frac', display: 'fraction', preview: '\\frac{a}{b}', signature: '\\frac{numerator}{denominator}', parts: ['\\frac{', { placeholder: 'numerator' }, '}{', { placeholder: 'denominator' }, '}'] },
  { backend: 'latex', name: 'gamma', display: 'γ gamma', preview: '\\gamma', parts: ['\\gamma'] },
  { backend: 'latex', name: 'infty', display: '∞ infinity', preview: '\\infty', parts: ['\\infty'] },
  { backend: 'latex', name: 'int', display: '∫ integral', preview: '\\int_a^b f(x)\\,dx', signature: '\\int_{lower}^{upper} integrand', parts: ['\\int_{', { placeholder: 'lower bound' }, '}^{', { placeholder: 'upper bound' }, '} ', { placeholder: 'integrand' }] },
  { backend: 'latex', name: 'leq', display: '≤ less than or equal', preview: 'a\\leq b', parts: ['\\leq'] },
  { backend: 'latex', name: 'mapsto', display: '↦ maps to', preview: 'a\\mapsto b', parts: ['\\mapsto'] },
  { backend: 'latex', name: 'mathbb', display: 'blackboard bold', preview: '\\mathbb{R}', signature: '\\mathbb{symbol}', parts: ['\\mathbb{', { placeholder: 'symbol' }, '}'] },
  { backend: 'latex', name: 'matrix', display: '2 × 2 matrix', preview: '\\begin{matrix}a & b \\\\ c & d\\end{matrix}', signature: '\\begin{matrix}…\\end{matrix}', parts: ['\\begin{matrix}', { placeholder: 'a' }, ' & ', { placeholder: 'b' }, ' \\\\ ', { placeholder: 'c' }, ' & ', { placeholder: 'd' }, '\\end{matrix}'] },
  { backend: 'latex', name: 'mp', display: '∓ minus-or-plus', preview: '\\mp', parts: ['\\mp'] },
  { backend: 'latex', name: 'mu', display: 'μ mu', preview: '\\mu', parts: ['\\mu'] },
  { backend: 'latex', name: 'neq', display: '≠ not equal', preview: 'a\\neq b', parts: ['\\neq'] },
  { backend: 'latex', name: 'pi', display: 'π pi', preview: '\\pi', parts: ['\\pi'] },
  { backend: 'latex', name: 'rightarrow', display: '→ right arrow', preview: 'a\\rightarrow b', parts: ['\\rightarrow'] },
  { backend: 'latex', name: 'sqrt', display: 'square root', preview: '\\sqrt{x}', signature: '\\sqrt{radicand}', parts: ['\\sqrt{', { placeholder: 'radicand' }, '}'] },
  { backend: 'latex', name: 'sum', display: '∑ summation', preview: '\\sum_{i=1}^{n} i', signature: '\\sum_{lower}^{upper} term', parts: ['\\sum_{', { placeholder: 'lower bound' }, '}^{', { placeholder: 'upper bound' }, '} ', { placeholder: 'term' }] },
  { backend: 'latex', name: 'times', display: '× times', preview: 'a\\times b', parts: ['\\times'] },
  { backend: 'latex', name: 'theta', display: 'θ theta', preview: '\\theta', parts: ['\\theta'] },
];

const typstCompletions: Completion[] = [
  { backend: 'typst', name: 'alpha', display: 'α alpha', preview: 'alpha', parts: ['alpha'] },
  { backend: 'typst', name: 'arrow.r', display: '→ right arrow', preview: 'arrow.r', parts: ['arrow.r'] },
  { backend: 'typst', name: 'beta', display: 'β beta', preview: 'beta', parts: ['beta'] },
  { backend: 'typst', name: 'frac', display: 'fraction', preview: 'frac(a, b)', signature: 'frac(numerator, denominator)', parts: ['frac(', { placeholder: 'numerator' }, ', ', { placeholder: 'denominator' }, ')'] },
  { backend: 'typst', name: 'integral', display: '∫ integral', preview: 'integral_a^b f(x) dif x', signature: 'integral_lower^upper integrand dif variable', parts: ['integral_', { placeholder: 'lower bound' }, ' ^', { placeholder: 'upper bound' }, ' ', { placeholder: 'integrand' }, ' dif ', { placeholder: 'variable' }] },
  { backend: 'typst', name: 'infinity', display: '∞ infinity', preview: 'infinity', parts: ['infinity'] },
  { backend: 'typst', name: 'mat', display: '2 × 2 matrix', preview: 'mat(a, b; c, d)', signature: 'mat(a, b; c, d)', parts: ['mat(', { placeholder: 'a' }, ', ', { placeholder: 'b' }, '; ', { placeholder: 'c' }, ', ', { placeholder: 'd' }, ')'] },
  { backend: 'typst', name: 'mu', display: 'μ mu', preview: 'mu', parts: ['mu'] },
  { backend: 'typst', name: 'pi', display: 'π pi', preview: 'pi', parts: ['pi'] },
  { backend: 'typst', name: 'sqrt', display: 'square root', preview: 'sqrt(x)', signature: 'sqrt(radicand)', parts: ['sqrt(', { placeholder: 'radicand' }, ')'] },
  { backend: 'typst', name: 'sum', display: '∑ summation', preview: 'sum_(i=1)^n i', signature: 'sum_(lower)^upper term', parts: ['sum_(', { placeholder: 'lower bound' }, ')^', { placeholder: 'upper bound' }, ' ', { placeholder: 'term' }] },
  { backend: 'typst', name: 'theta', display: 'θ theta', preview: 'theta', parts: ['theta'] },
  { backend: 'typst', name: 'times', display: '× times', preview: 'times', parts: ['times'] },
];

const catalogs: Record<CompletionBackend, Completion[]> = {
  latex: latexCompletions,
  typst: typstCompletions,
};

/** Finds catalog entries for the identifier immediately before the caret. */
export function findCompletions(
  backend: CompletionBackend,
  value: string,
  caret: number,
  selectionStart = caret,
  selectionEnd = caret,
): CompletionMatch[] {
  if (caret < 0 || caret > value.length || selectionStart !== selectionEnd || selectionStart !== caret) return [];

  const beforeCaret = value.slice(0, caret);
  const afterCaret = value.slice(caret);
  let query: string;
  let start: number;

  if (backend === 'latex') {
    if (/[A-Za-z]/.test(afterCaret[0] ?? '')) return [];
    const match = /\\([A-Za-z]*)$/.exec(beforeCaret);
    if (!match || match[1].length === 0) return [];
    query = match[1];
    start = caret - match[0].length;
  } else {
    if (/[A-Za-z.]/.test(afterCaret[0] ?? '')) return [];
    const match = /[A-Za-z][A-Za-z.]*$/.exec(beforeCaret);
    if (!match) return [];
    query = match[0];
    start = caret - query.length;
    if (beforeCaret[start - 1] === '\\') return [];
  }

  const matches = catalogs[backend]
    .filter((completion) => completion.name.startsWith(query))
    .sort((a, b) => Number(a.name !== query) - Number(b.name !== query) || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map((completion) => ({ completion, query, range: { start, end: caret } }));

  return matches;
}

/** Replaces the matched query with literal/snippet parts and computes source ranges. */
export function applyCompletion(value: string, match: CompletionMatch): AppliedCompletion {
  const { start, end } = match.range;
  let inserted = '';
  const allPlaceholders: TextRange[] = [];
  for (const part of match.completion.parts) {
    if (typeof part === 'string') {
      inserted += part;
    } else {
      const placeholderStart = start + inserted.length;
      inserted += part.placeholder;
      allPlaceholders.push({ start: placeholderStart, end: placeholderStart + part.placeholder.length });
    }
  }

  const updated = value.slice(0, start) + inserted + value.slice(end);
  return {
    value: updated,
    selection: allPlaceholders[0] ?? null,
    placeholders: allPlaceholders.slice(1),
    finalCaret: allPlaceholders.length > 0
      ? { start: start + inserted.length, end: start + inserted.length }
      : null,
  };
}

/** Rebases remaining snippet ranges after replacing one source range. */
export function rebaseRanges(
  ranges: TextRange[],
  edit: TextRange,
  insertedLength: number,
): TextRange[] | null {
  const delta = insertedLength - (edit.end - edit.start);
  const rebased: TextRange[] = [];
  for (const range of ranges) {
    if (edit.start < range.end && edit.end > range.start) return null;
    if (edit.start === edit.end && edit.start > range.start && edit.start < range.end) return null;
    rebased.push(edit.end <= range.start
      ? { start: range.start + delta, end: range.end + delta }
      : { ...range });
  }
  return rebased;
}
