export type TextRange = { start: number; end: number };

export type CompletionBackend = 'latex' | 'typst';

export type SnippetPart = string | { placeholder: string };

export type Completion = {
  backend: CompletionBackend;
  name: string;
  display: string;
  preview: string;
  symbol?: string;
  signature?: string;
  parts: SnippetPart[];
};

export type CompletionMatch = {
  completion: Completion;
  query: string;
  range: TextRange;
  matchedIndices: number[];
  matchKind: 'exact' | 'prefix' | 'fuzzy';
};

export type AppliedCompletion = {
  value: string;
  selection: TextRange | null;
  placeholders: TextRange[];
  finalCaret: TextRange | null;
};

const latexAtomic = (name: string, display: string, symbol: string, preview = `\\${name}`): Completion => ({
  backend: 'latex', name, display, symbol, preview, parts: [`\\${name} `],
});
const latexStructure = (
  name: string,
  display: string,
  preview: string,
  signature: string,
  parts: SnippetPart[],
): Completion => {
  const terminatedParts = [...parts];
  const last = terminatedParts[terminatedParts.length - 1];
  if (typeof last === 'string') terminatedParts[terminatedParts.length - 1] = `${last} `;
  else terminatedParts.push(' ');
  return { backend: 'latex', name, display, preview, signature, parts: terminatedParts };
};
const slot = (): { placeholder: string } => ({ placeholder: '' });

// Order is intentional: familiar commands such as mu and mp stay prominent.
const latexCompletions: Completion[] = [
  latexAtomic('mu', 'μ mu', 'μ'),
  latexAtomic('mp', '∓ minus-or-plus', '∓'),
  latexAtomic('mapsto', '↦ maps to', '↦', 'a\\mapsto b'),
  latexStructure('mathbb', 'blackboard bold', '\\mathbb{R}', '\\mathbb{symbol}', ['\\mathbb{', slot(), '}']),
  latexStructure('mathrm', 'roman font', '\\mathrm{d}x', '\\mathrm{symbol}', ['\\mathrm{', slot(), '}']),
  latexStructure('mathbf', 'bold font', '\\mathbf{x}', '\\mathbf{symbol}', ['\\mathbf{', slot(), '}']),
  latexStructure('mathcal', 'calligraphic font', '\\mathcal{F}', '\\mathcal{symbol}', ['\\mathcal{', slot(), '}']),
  latexStructure('mathfrak', 'Fraktur font', '\\mathfrak{g}', '\\mathfrak{symbol}', ['\\mathfrak{', slot(), '}']),
  latexStructure('matrix', '2 × 2 matrix', '\\begin{matrix}a & b \\\\ c & d\\end{matrix}', '\\begin{matrix}…\\end{matrix}', ['\\begin{matrix}', slot(), ' & ', slot(), ' \\\\ ', slot(), ' & ', slot(), '\\end{matrix}']),
  latexAtomic('alpha', 'α alpha', 'α'),
  latexAtomic('beta', 'β beta', 'β'),
  latexAtomic('gamma', 'γ gamma', 'γ'),
  latexAtomic('delta', 'δ delta', 'δ'),
  latexAtomic('epsilon', 'ε epsilon', 'ε'),
  latexAtomic('varepsilon', 'ϵ variant epsilon', 'ϵ'),
  latexAtomic('zeta', 'ζ zeta', 'ζ'),
  latexAtomic('eta', 'η eta', 'η'),
  latexAtomic('theta', 'θ theta', 'θ'),
  latexAtomic('vartheta', 'ϑ variant theta', 'ϑ'),
  latexAtomic('iota', 'ι iota', 'ι'),
  latexAtomic('kappa', 'κ kappa', 'κ'),
  latexAtomic('lambda', 'λ lambda', 'λ'),
  latexAtomic('nu', 'ν nu', 'ν'),
  latexAtomic('xi', 'ξ xi', 'ξ'),
  latexAtomic('pi', 'π pi', 'π'),
  latexAtomic('varpi', 'ϖ variant pi', 'ϖ'),
  latexAtomic('rho', 'ρ rho', 'ρ'),
  latexAtomic('sigma', 'σ sigma', 'σ'),
  latexAtomic('tau', 'τ tau', 'τ'),
  latexAtomic('upsilon', 'υ upsilon', 'υ'),
  latexAtomic('phi', 'ϕ phi', 'ϕ'),
  latexAtomic('varphi', 'φ variant phi', 'φ'),
  latexAtomic('chi', 'χ chi', 'χ'),
  latexAtomic('psi', 'ψ psi', 'ψ'),
  latexAtomic('omega', 'ω omega', 'ω'),
  latexAtomic('Gamma', 'Γ capital gamma', 'Γ'),
  latexAtomic('Delta', 'Δ capital delta', 'Δ'),
  latexAtomic('Theta', 'Θ capital theta', 'Θ'),
  latexAtomic('Lambda', 'Λ capital lambda', 'Λ'),
  latexAtomic('Xi', 'Ξ capital xi', 'Ξ'),
  latexAtomic('Pi', 'Π capital pi', 'Π'),
  latexAtomic('Sigma', 'Σ capital sigma', 'Σ'),
  latexAtomic('Phi', 'Φ capital phi', 'Φ'),
  latexAtomic('Psi', 'Ψ capital psi', 'Ψ'),
  latexAtomic('Omega', 'Ω capital omega', 'Ω'),
  latexAtomic('approx', '≈ approximately equal', '≈', 'a\\approx b'),
  latexAtomic('neq', '≠ not equal', '≠', 'a\\neq b'),
  latexAtomic('leq', '≤ less than or equal', '≤', 'a\\leq b'),
  latexAtomic('geq', '≥ greater than or equal', '≥', 'a\\geq b'),
  latexAtomic('in', '∈ element of', '∈', 'x\\in A'),
  latexAtomic('notin', '∉ not an element of', '∉', 'x\\notin A'),
  latexAtomic('subset', '⊂ subset', '⊂', 'A\\subset B'),
  latexAtomic('subseteq', '⊆ subset or equal', '⊆', 'A\\subseteq B'),
  latexAtomic('cdot', '⋅ centered dot', '⋅', 'a\\cdot b'),
  latexAtomic('times', '× times', '×', 'a\\times b'),
  latexAtomic('pm', '± plus-or-minus', '±'),
  latexAtomic('rightarrow', '→ right arrow', '→', 'a\\rightarrow b'),
  latexAtomic('leftarrow', '← left arrow', '←', 'a\\leftarrow b'),
  latexAtomic('leftrightarrow', '↔ left-right arrow', '↔', 'a\\leftrightarrow b'),
  latexAtomic('Rightarrow', '⇒ double right arrow', '⇒', 'A\\Rightarrow B'),
  latexAtomic('to', '→ arrow', '→', 'a\\to b'),
  latexAtomic('infty', '∞ infinity', '∞'),
  latexAtomic('partial', '∂ partial derivative', '∂'),
  latexAtomic('nabla', '∇ nabla', '∇'),
  latexAtomic('prod', '∏ product', '∏'),
  latexAtomic('lim', 'lim limit', 'lim', '\\lim_{x\\to 0} f(x)'),
  latexStructure('frac', 'fraction', '\\frac{a}{b}', '\\frac{a}{b}', ['\\frac{', slot(), '}{', slot(), '}']),
  latexStructure('cfrac', 'continued fraction', '\\cfrac{a}{b}', '\\cfrac{a}{b}', ['\\cfrac{', slot(), '}{', slot(), '}']),
  latexStructure('dfrac', 'display fraction', '\\dfrac{a}{b}', '\\dfrac{a}{b}', ['\\dfrac{', slot(), '}{', slot(), '}']),
  latexStructure('sqrt', 'square root', '\\sqrt{x}', '\\sqrt{radicand}', ['\\sqrt{', slot(), '}']),
  latexStructure('sum', 'summation', '\\sum_{i=1}^{n} i', '\\sum_{lower}^{upper} term', ['\\sum_{', slot(), '}^{', slot(), '} ', slot()]),
  latexStructure('int', 'integral', '\\int_a^b f(x)\\,dx', '\\int_{lower}^{upper} integrand', ['\\int_{', slot(), '}^{', slot(), '} ', slot()]),
  latexStructure('cases', 'piecewise cases', '\\begin{cases}x & x>0\\\\0 & x\\leq 0\\end{cases}', '\\begin{cases}…\\end{cases}', ['\\begin{cases}', slot(), ' & ', slot(), ' \\\\ ', slot(), ' & ', slot(), '\\end{cases}']),
];

const typstAtomic = (name: string, display: string, symbol: string, preview = name): Completion => ({
  backend: 'typst', name, display, symbol, preview, parts: [`${name} `],
});
const typstStructure = (name: string, display: string, preview: string, signature: string, parts: SnippetPart[]): Completion => ({
  backend: 'typst', name, display, preview, signature, parts,
});

const typstCompletions: Completion[] = [
  typstAtomic('mu', 'μ mu', 'μ'),
  typstAtomic('alpha', 'α alpha', 'α'),
  typstAtomic('beta', 'β beta', 'β'),
  typstAtomic('gamma', 'γ gamma', 'γ'),
  typstAtomic('delta', 'δ delta', 'δ'),
  typstAtomic('epsilon', 'ε epsilon', 'ε'),
  typstAtomic('theta', 'θ theta', 'θ'),
  typstAtomic('lambda', 'λ lambda', 'λ'),
  typstAtomic('pi', 'π pi', 'π'),
  typstAtomic('sigma', 'σ sigma', 'σ'),
  typstAtomic('phi', 'ϕ phi', 'ϕ'),
  typstAtomic('omega', 'ω omega', 'ω'),
  typstAtomic('infinity', '∞ infinity', '∞'),
  typstAtomic('times', '× times', '×'),
  typstAtomic('plus.minus', '± plus-minus', '±'),
  typstAtomic('equiv', '≡ equivalent', '≡'),
  typstAtomic('approx', '≈ approximate', '≈'),
  typstAtomic('arrow.r', '→ right arrow', '→'),
  typstAtomic('arrow.l', '← left arrow', '←'),
  typstAtomic('arrow.l.r', '↔ left-right arrow', '↔'),
  typstAtomic('arrow.r.double', '⇒ double right arrow', '⇒'),
  typstAtomic('in', '∈ element of', '∈'),
  typstAtomic('notin', '∉ not an element of', '∉'),
  typstAtomic('union', '∪ union', '∪'),
  typstAtomic('inter', '∩ intersection', '∩'),
  typstStructure('frac', 'fraction', 'frac(a, b)', 'frac(a, b)', ['frac(', slot(), ', ', slot(), ')']),
  typstStructure('sqrt', 'square root', 'sqrt(x)', 'sqrt(radicand)', ['sqrt(', slot(), ')']),
  typstStructure('sum', 'summation', 'sum_(i=1)^n i', 'sum_(lower)^upper term', ['sum_(', slot(), ')^', slot(), ' ', slot()]),
  typstStructure('integral', 'integral', 'integral_a^b f(x) dif x', 'integral_lower^upper integrand', ['integral_(', slot(), ')^', slot(), ' ', slot(), ' dif x']),
  typstStructure('mat', 'matrix', 'mat(a, b; c, d)', 'mat(a, b; c, d)', ['mat(', slot(), ', ', slot(), '; ', slot(), ', ', slot(), ')']),
  typstStructure('cases', 'piecewise cases', 'cases(x, x > 0; 0, x <= 0)', 'cases(value, condition; …)', ['cases(', slot(), ', ', slot(), '; ', slot(), ', ', slot(), ')']),
];

const catalogs: Record<CompletionBackend, Completion[]> = { latex: latexCompletions, typst: typstCompletions };

function subsequenceIndices(name: string, query: string): number[] | null {
  const indices: number[] = [];
  let searchFrom = 0;
  for (const character of query) {
    const index = name.indexOf(character, searchFrom);
    if (index < 0) return null;
    indices.push(index);
    searchFrom = index + 1;
  }
  return indices;
}

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

  const ranked = catalogs[backend].flatMap((completion, catalogIndex) => {
    const name = completion.name;
    const matchedIndices = subsequenceIndices(name, query);
    if (!matchedIndices) return [];
    const matchKind: CompletionMatch['matchKind'] = name === query ? 'exact' : name.startsWith(query) ? 'prefix' : 'fuzzy';
    const gaps = matchedIndices[matchedIndices.length - 1] - matchedIndices[0] + 1 - matchedIndices.length;
    return [{ completion, query, range: { start, end: caret }, matchedIndices, matchKind, gaps, catalogIndex }];
  });

  ranked.sort((a, b) => {
    const kindOrder = { exact: 0, prefix: 1, fuzzy: 2 };
    const byKind = kindOrder[a.matchKind] - kindOrder[b.matchKind];
    if (byKind) return byKind;
    if (a.matchKind !== 'fuzzy') return a.catalogIndex - b.catalogIndex;
    return a.gaps - b.gaps || a.completion.name.length - b.completion.name.length || a.catalogIndex - b.catalogIndex;
  });
  return ranked.slice(0, 30).map(({ completion, query: matchedQuery, range, matchedIndices, matchKind }) => ({
    completion, query: matchedQuery, range, matchedIndices, matchKind,
  }));
}

/** Replaces the matched query with literal/snippet parts and computes zero-width source ranges. */
export function applyCompletion(value: string, match: CompletionMatch): AppliedCompletion {
  const { start, end } = match.range;
  let inserted = '';
  const slots: TextRange[] = [];
  for (const part of match.completion.parts) {
    if (typeof part === 'string') {
      inserted += part;
    } else {
      const position = start + inserted.length;
      slots.push({ start: position, end: position });
    }
  }

  const suffix = value.slice(end);
  if (suffix.startsWith(' ') && inserted.endsWith(' ')) inserted = inserted.slice(0, -1);
  const updated = value.slice(0, start) + inserted + suffix;
  return {
    value: updated,
    selection: slots[0] ?? null,
    placeholders: slots.slice(1),
    finalCaret: slots.length > 0
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
