import { describe, expect, it } from 'vitest';
import {
  applyCompletion,
  findCompletions,
  rebaseRanges,
  type TextRange,
} from './completion';

describe('findCompletions', () => {
  it('matches LaTeX backslash prefixes and reports the replaced query range', () => {
    const matches = findCompletions('latex', 'before \\fra', 11);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toMatchObject({
      completion: { name: 'frac', backend: 'latex' },
      query: 'fra',
      range: { start: 7, end: 11 },
    });
  });

  it('matches Typst dotted symbol names as one prefix', () => {
    const matches = findCompletions('typst', 'arrow.r', 7);

    expect(matches[0]).toMatchObject({
      completion: { name: 'arrow.r', backend: 'typst' },
      query: 'arrow.r',
      range: { start: 0, end: 7 },
    });
  });

  it('does not treat a LaTeX backslash command as a Typst name', () => {
    expect(findCompletions('typst', '\\frac', 5)).toEqual([]);
  });

  it('offers common m-prefixed symbols and matrix structures for both backends', () => {
    expect(findCompletions('latex', '\\m', 2).map(({ completion }) => completion.name)).toEqual(
      expect.arrayContaining(['mu', 'mp', 'matrix']),
    );
    expect(findCompletions('typst', 'm', 1).map(({ completion }) => completion.name)).toEqual(
      expect.arrayContaining(['mu', 'mat']),
    );
  });

  it('does not offer matches when the caret is in the middle of an identifier', () => {
    expect(findCompletions('latex', '\\fracx', 5)).toEqual([]);
    expect(findCompletions('typst', 'arrow.right', 7)).toEqual([]);
  });

  it('rejects selected text and empty/non-command prefixes', () => {
    expect(findCompletions('latex', '\\fra', 4, 1, 4)).toEqual([]);
    expect(findCompletions('latex', 'fra', 3)).toEqual([]);
  });

  it('ranks strict prefix results before fuzzy subsequence matches and reports matched character indices', () => {
    const matches = findCompletions('latex', '\\fra', 4);

    expect(matches[0]).toMatchObject({
      completion: { name: 'frac' },
      matchKind: 'prefix',
      matchedIndices: [0, 1, 2],
    });
    expect(matches.find(({ completion }) => completion.name === 'cfrac')).toMatchObject({ matchKind: 'fuzzy', matchedIndices: [1, 2, 3] });
    expect(matches.find(({ completion }) => completion.name === 'dfrac')).toMatchObject({ matchKind: 'fuzzy', matchedIndices: [1, 2, 3] });
  });

  it('ranks exact and prefix matches before fuzzy results, retaining curated order within those classes', () => {
    const exact = findCompletions('latex', '\\mu', 3);
    const matches = findCompletions('latex', '\\m', 2);

    expect(exact[0]).toMatchObject({ completion: { name: 'mu' }, matchKind: 'exact', matchedIndices: [0, 1] });
    expect(matches.slice(0, 3).map(({ completion }) => completion.name)).toEqual(['mu', 'mp', 'mapsto']);
    expect(findCompletions('latex', '\\Mu', 3)).toEqual([]);
  });

  it('returns no more than thirty candidates', () => {
    expect(findCompletions('latex', '\\a', 2).length).toBeLessThanOrEqual(30);
  });

  it('includes a broad curated command and Typst symbol catalog', () => {
    const latex = findCompletions('latex', '\\m', 2);
    expect(latex.map(({ completion }) => completion.name)).toEqual(expect.arrayContaining([
      'mapsto', 'mathbb', 'mathrm', 'mathbf', 'mathcal', 'mathfrak', 'matrix', 'mu', 'mp',
    ]));
    expect(findCompletions('typst', 'arrow.', 6).map(({ completion }) => completion.name)).toContain('arrow.r');
  });
});

describe('applyCompletion', () => {
  it('inserts structural snippets with empty slots and zero-width tab stops', () => {
    const match = findCompletions('latex', 'x \\fra y', 6).find(({ completion }) => completion.name === 'frac')!;

    expect(applyCompletion('x \\fra y', match)).toEqual({
      value: 'x \\frac{}{} y',
      selection: { start: 8, end: 8 },
      placeholders: [{ start: 10, end: 10 }],
      finalCaret: { start: 11, end: 11 },
    });
  });

  it('adds a trailing terminator space to atomic LaTeX commands', () => {
    const [match] = findCompletions('latex', '\\alp', 4);
    expect(applyCompletion('\\alp', match)).toMatchObject({ value: '\\alpha ', selection: null, finalCaret: null });
  });

  it('inserts a LaTeX square root with an empty selected slot and trailing terminator', () => {
    const [match] = findCompletions('latex', '\\sqrt', 5).filter(({ completion }) => completion.name === 'sqrt');
    expect(applyCompletion('\\sqrt', match)).toMatchObject({
      value: '\\sqrt{} ',
      selection: { start: 6, end: 6 },
      finalCaret: { start: 8, end: 8 },
    });
  });

  it('inserts Typst structures using empty valid argument slots', () => {
    const [match] = findCompletions('typst', 'frac', 4);
    expect(applyCompletion('frac', match)).toMatchObject({
      value: 'frac(, )',
      selection: { start: 5, end: 5 },
      placeholders: [{ start: 7, end: 7 }],
    });
  });
});

describe('rebaseRanges', () => {
  const placeholders: TextRange[] = [{ start: 10, end: 14 }, { start: 20, end: 24 }];

  it('shifts ranges after an edit before them by the inserted-minus-removed length', () => {
    expect(rebaseRanges(placeholders, { start: 2, end: 4 }, 5)).toEqual([
      { start: 13, end: 17 },
      { start: 23, end: 27 },
    ]);
  });

  it('invalidates when an edit overlaps a remaining placeholder', () => {
    expect(rebaseRanges(placeholders, { start: 12, end: 13 }, 2)).toBeNull();
  });

  it('shifts a later placeholder after editing an earlier placeholder', () => {
    expect(rebaseRanges([placeholders[1]], { start: 10, end: 14 }, 6)).toEqual([
      { start: 22, end: 26 },
    ]);
  });
});
