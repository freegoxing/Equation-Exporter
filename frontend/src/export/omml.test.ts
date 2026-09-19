import { expect, test } from "vitest";

import { mathmlToOmml, officeFormulaArguments } from "./omml";
import { renderLatexMathml } from "../preview/latex-preview";

const wrapMathml = (content: string) => `<math xmlns="http://www.w3.org/1998/Math/MathML">${content}</math>`;

test("converts a MathML fraction into an OMML fraction", () => {
  const omml = mathmlToOmml(wrapMathml("<mfrac><mi>a</mi><mi>b</mi></mfrac>"));

  expect(omml).toContain(
    '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">',
  );
  expect(omml).toContain("<m:f>");
  expect(omml).toContain("<m:num>");
  expect(omml).toContain("<m:den>");
  expect(omml).toContain("<m:t>a</m:t>");
  expect(omml).toContain("<m:t>b</m:t>");
});

test("preserves Chinese MathML text as a normal OMML run", () => {
  const omml = mathmlToOmml(wrapMathml("<mtext>速度</mtext>"));

  expect(omml).toContain("<m:nor/>");
  expect(omml).toContain("速度");
});

test("rejects an unknown MathML element", () => {
  expect(() => mathmlToOmml(wrapMathml("<munknown/>"))).toThrow(
    "Unsupported MathML element: munknown",
  );
});

test.each([
  ["<msqrt><mi>x</mi></msqrt>", "<m:rad>"],
  ["<mroot><mi>x</mi><mn>3</mn></mroot>", "<m:rad>"],
  ["<msub><mi>x</mi><mn>1</mn></msub>", "<m:sSub>"],
  ["<msup><mi>x</mi><mn>2</mn></msup>", "<m:sSup>"],
  ["<msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup>", "<m:sSubSup>"],
  ["<munder><mo>∑</mo><mi>i</mi></munder>", "<m:limLow>"],
  ["<mover><mo>∑</mo><mi>i</mi></mover>", "<m:limUpp>"],
  ["<munderover><mo>∑</mo><mi>i</mi><mi>n</mi></munderover>", "<m:nary>"],
  [
    "<mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr></mtable>",
    "<m:m>",
  ],
] as const)("maps %s to %s", (source, expected) => {
  expect(mathmlToOmml(wrapMathml(source))).toContain(expected);
});

test("preserves matrix row and column counts in OMML properties", () => {
  const omml = mathmlToOmml(
    wrapMathml("<mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable>"),
  );

  expect(omml).toContain("<m:mPr>");
  expect(omml).toContain("<m:mPr><m:mcs><m:mc><m:mcPr>");
  expect(omml).not.toContain("<m:mPr><m:mcPr>");
  expect(omml).toMatch(/<m:count[^>]*val="2"/);
});

test("escapes token text as XML text", () => {
  const omml = mathmlToOmml("<math xmlns=\"http://www.w3.org/1998/Math/MathML\"><mtext>&amp; &lt; &gt; &quot; &apos;</mtext></math>");

  expect(omml).toContain("&amp;");
  expect(omml).toContain("&lt;");
  expect(omml).toContain("&gt;");
  expect(omml).toContain("&quot;");
  expect(omml).toContain("&apos;");
  expect(omml).not.toContain("<mtext>");
});

test("rejects blank, malformed, non-MathML, and multiple roots", () => {
  expect(() => mathmlToOmml("  ")).toThrow();
  expect(() => mathmlToOmml("<math><mi>x</math>")).toThrow();
  expect(() => mathmlToOmml("<svg><mi>x</mi></svg>")).toThrow();
  expect(() => mathmlToOmml("<math><mi>x</mi></math><math><mi>y</mi></math>")).toThrow();
});

test.each([
  ["<math><mi value=x>x</mi></math>", "malformed attribute"],
  ["<math><mi>x</mi></math>trailing", "trailing non-whitespace content"],
  ["<math><mi>x</mi></math><", "trailing malformed content"],
])("rejects %s (%s)", (mathml) => {
  expect(() => mathmlToOmml(mathml)).toThrow("Invalid MathML XML");
});

test.each([
  ["<math><mi>x</mi></math>", "absent namespace"],
  [
    '<math xmlns="http://www.w3.org/2000/svg"><mi>x</mi></math>',
    "wrong namespace",
  ],
])("rejects MathML with %s", (mathml) => {
  expect(() => mathmlToOmml(mathml)).toThrow(/MathML namespace/);
});

test("wraps OMML and LaTeX without changing either payload", () => {
  const result = officeFormulaArguments("<m:oMath/>", "x^2");

  expect(result).toEqual({ omml: "<m:oMath/>", latex: "x^2" });
});

test.each([
  "\\frac{a}{b}",
  "\\sqrt{x}",
  "x_i^2",
  "\\sum_{i=1}^{n} i",
  "\\begin{bmatrix}a & b\\\\ c & d\\end{bmatrix}",
  "\\text{速度} = \\frac{s}{t}",
])("accepts MathJax MathML for the WPS manual-acceptance formula %s", async (latex) => {
  const mathml = await renderLatexMathml(latex);

  expect(mathmlToOmml(mathml)).toMatch(/^<m:oMath\b/);
});
