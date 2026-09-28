import { describe, expect, it } from 'vitest';
import {
  applyCompletion,
  findCompletions,
  rebaseRanges,
  type Completion,
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

  it('orders exact matches first, then other prefix matches deterministically, and caps at eight', () => {
    const matches = findCompletions('latex', '\\s', 2);

    expect(matches.length).toBeLessThanOrEqual(8);
    expect(matches[0].completion.name).toBe('sqrt');
    expect(matches.map(({ completion }) => completion.name)).toEqual(
      [...matches.map(({ completion }) => completion.name)].sort((a, b) => {
        const exactOrder = Number(a !== 's') - Number(b !== 's');
        return exactOrder || a.localeCompare(b);
      }),
    );
  });
});

describe('applyCompletion', () => {
  it('inserts structural snippets and returns explicit placeholder ranges', () => {
    const completion: Completion = {
      backend: 'latex',
      name: 'frac',
      display: 'fraction',
      preview: '\\frac{a}{b}',
      parts: ['\\frac{', { placeholder: 'numerator' }, '}{', { placeholder: 'denominator' }, '}'],
    };
    const match = {
      completion,
      query: 'fra',
      range: { start: 2, end: 6 } satisfies TextRange,
    };

    expect(applyCompletion('x \\fra y', match)).toEqual({
      value: 'x \\frac{numerator}{denominator} y',
      selection: { start: 8, end: 17 },
      placeholders: [{ start: 19, end: 30 }],
      finalCaret: { start: 31, end: 31 },
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
