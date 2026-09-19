const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
const OMML_NAMESPACE = "http://schemas.openxmlformats.org/officeDocument/2006/math";

type XmlNode = {
  nodeType: number;
  nodeName: string;
  kind?: string;
  value?: string;
  children?: XmlNode[];
  attributes?: Record<string, string>;
  localName?: string | null;
  namespaceURI?: string | null;
  textContent?: string | null;
  childNodes?: { length: number; [index: number]: XmlNode };
  getAttribute?: (name: string) => string | null;
};

type XmlDocument = XmlNode & {
  documentElement?: XmlNode | null;
};

type XmlParser = {
  parseFromString(source: string, contentType: string): XmlDocument;
};

function xmlParser(): XmlParser {
  if (typeof globalThis.DOMParser === "function") {
    return new globalThis.DOMParser() as unknown as XmlParser;
  }

  return {
    parseFromString: (source) => parseStrictXml(source),
  };
}

const XML_NAME = /[A-Za-z_][A-Za-z0-9_.:-]*/y;

function decodeXmlEntities(value: string): string {
  if (/&(?!#x[0-9a-fA-F]+;|#[0-9]+;|amp;|lt;|gt;|quot;|apos;)/.test(value)) {
    throw new Error("Invalid MathML XML");
  }
  const decoded = value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    const codePoint = entity.startsWith("#x")
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
      throw new Error("Invalid MathML XML");
    }
    return String.fromCodePoint(codePoint);
  });
  return decoded;
}

function parseXmlName(source: string, index: number): { name: string; next: number } {
  XML_NAME.lastIndex = index;
  const match = XML_NAME.exec(source);
  if (!match) throw new Error("Invalid MathML XML");
  return { name: match[0], next: XML_NAME.lastIndex };
}

function isXmlWhitespace(character: string): boolean {
  return /[\t\n\r ]/.test(character);
}

function skipXmlWhitespace(source: string, index: number): number {
  while (index < source.length && isXmlWhitespace(source[index])) index += 1;
  return index;
}

function appendXmlChild(parent: XmlNode, child: XmlNode): void {
  if (!parent.childNodes) parent.childNodes = [];
  parent.childNodes[parent.childNodes.length] = child;
  if (child.nodeType === 1) {
    if (!parent.children) parent.children = [];
    parent.children[parent.children.length] = child;
  }
}

function parseStrictXml(source: string): XmlDocument {
  const document: XmlDocument = {
    nodeType: 9,
    nodeName: "#document",
    childNodes: [],
    documentElement: null,
  };
  const stack: Array<{ name: string; node: XmlNode }> = [];
  const namespaces: Array<Record<string, string | null>> = [];
  let root: XmlNode | null = null;
  let index = 0;

  const appendText = (value: string): void => {
    if (value === "") return;
    const decoded = decodeXmlEntities(value);
    const parent = stack.at(-1)?.node;
    if (!parent) {
      if (decoded.trim() !== "") throw new Error("Invalid MathML XML");
      appendXmlChild(document, { nodeType: 3, nodeName: "#text", value: decoded, textContent: decoded });
      return;
    }
    appendXmlChild(parent, { nodeType: 3, nodeName: "#text", value: decoded, textContent: decoded });
  };

  while (index < source.length) {
    if (source[index] !== "<") {
      const nextTag = source.indexOf("<", index);
      appendText(source.slice(index, nextTag < 0 ? source.length : nextTag));
      index = nextTag < 0 ? source.length : nextTag;
      continue;
    }

    if (source.startsWith("<!--", index)) {
      const end = source.indexOf("-->", index + 4);
      if (end < 0) throw new Error("Invalid MathML XML");
      appendXmlChild(stack.at(-1)?.node ?? document, {
        nodeType: 8,
        nodeName: "#comment",
        value: source.slice(index + 4, end),
      });
      index = end + 3;
      continue;
    }
    if (source.startsWith("<?", index)) {
      const end = source.indexOf("?>", index + 2);
      if (end < 0) throw new Error("Invalid MathML XML");
      index = end + 2;
      continue;
    }
    if (source.startsWith("<![CDATA[", index)) {
      const end = source.indexOf("]]>", index + 9);
      if (end < 0 || !stack.length) throw new Error("Invalid MathML XML");
      appendText(source.slice(index + 9, end).replace(/&/g, "&amp;"));
      index = end + 3;
      continue;
    }
    if (source.startsWith("<!", index)) throw new Error("Invalid MathML XML");

    if (source.startsWith("</", index)) {
      const parsed = parseXmlName(source, index + 2);
      const end = skipXmlWhitespace(source, parsed.next);
      if (source[end] !== ">" || stack.at(-1)?.name !== parsed.name) {
        throw new Error("Invalid MathML XML");
      }
      stack.pop();
      namespaces.pop();
      index = end + 1;
      continue;
    }

    const parsed = parseXmlName(source, index + 1);
    let cursor = skipXmlWhitespace(source, parsed.next);
    let selfClosing = false;
    const attributes: Record<string, string> = {};
    const declarations: Record<string, string | null> = {};
    while (cursor < source.length && source[cursor] !== ">") {
      if (source[cursor] === "/") {
        if (selfClosing) throw new Error("Invalid MathML XML");
        selfClosing = true;
        cursor = skipXmlWhitespace(source, cursor + 1);
        if (source[cursor] !== ">") throw new Error("Invalid MathML XML");
        continue;
      }
      if (selfClosing) throw new Error("Invalid MathML XML");
      const attribute = parseXmlName(source, cursor);
      cursor = skipXmlWhitespace(source, attribute.next);
      if (source[cursor] !== "=") throw new Error("Invalid MathML XML");
      cursor = skipXmlWhitespace(source, cursor + 1);
      const quote = source[cursor];
      if (quote !== '"' && quote !== "'") throw new Error("Invalid MathML XML");
      const valueEnd = source.indexOf(quote, cursor + 1);
      if (valueEnd < 0) throw new Error("Invalid MathML XML");
      if (Object.hasOwn(attributes, attribute.name)) throw new Error("Invalid MathML XML");
      if (source.slice(cursor + 1, valueEnd).includes("<")) throw new Error("Invalid MathML XML");
      const value = decodeXmlEntities(source.slice(cursor + 1, valueEnd));
      attributes[attribute.name] = value;
      if (attribute.name === "xmlns") declarations[""] = value || null;
      else if (attribute.name.startsWith("xmlns:")) declarations[attribute.name.slice(6)] = value || null;
      cursor = skipXmlWhitespace(source, valueEnd + 1);
    }
    if (source[cursor] !== ">") throw new Error("Invalid MathML XML");

    const parentNamespaces = namespaces.at(-1) ?? {};
    const currentNamespaces: Record<string, string | null> = { ...parentNamespaces, ...declarations };
    const colon = parsed.name.indexOf(":");
    const prefix = colon < 0 ? "" : parsed.name.slice(0, colon);
    const namespaceURI = currentNamespaces[prefix] ?? null;
    if (colon >= 0 && namespaceURI === null) throw new Error("Invalid MathML XML");
    const node: XmlNode = {
      nodeType: 1,
      nodeName: parsed.name,
      localName: colon < 0 ? parsed.name : parsed.name.slice(colon + 1),
      namespaceURI,
      attributes,
      childNodes: [],
      children: [],
      getAttribute: (name: string) => attributes[name] ?? null,
    };
    appendXmlChild(stack.at(-1)?.node ?? document, node);
    if (!root) root = node;
    else if (!stack.length) throw new Error("Invalid MathML XML");
    if (!selfClosing) {
      stack.push({ name: parsed.name, node });
      namespaces.push(currentNamespaces);
    }
    index = cursor + 1;
  }

  if (!root || stack.length) throw new Error("Invalid MathML XML");
  return { ...document, documentElement: root };
}

function childElements(node: XmlNode): XmlNode[] {
  const children = node.childNodes;
  const fallbackChildren = node.children;
  if (!children && !fallbackChildren) return [];

  const elements: XmlNode[] = [];
  if (children) {
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child?.nodeType === 1 || (child?.kind && !child.kind.startsWith("#"))) elements.push(child);
    }
  } else {
    for (const child of fallbackChildren ?? []) {
      if (child?.kind && !child.kind.startsWith("#")) elements.push(child);
    }
  }
  return elements;
}

function elementName(node: XmlNode): string {
  return node.localName || node.nodeName?.split(":").pop() || node.kind || "";
}

function nodeText(node: XmlNode): string {
  if (node.textContent !== undefined && node.textContent !== null) return node.textContent;
  if (node.kind === "#text") return node.value ?? "";
  if (node.childNodes) {
    return Array.from({ length: node.childNodes.length }, (_, index) => node.childNodes?.[index]).map((child) =>
      child ? nodeText(child) : "",
    ).join("");
  }
  return (node.children ?? []).map(nodeText).join("");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textRun(value: string, normal = false): string {
  return normal
    ? `<m:r><m:rPr><m:nor/></m:rPr><m:t>${escapeXml(value)}</m:t></m:r>`
    : `<m:r><m:t>${escapeXml(value)}</m:t></m:r>`;
}

function requireChildren(node: XmlNode, count: number): XmlNode[] {
  const children = childElements(node);
  if (children.length !== count) {
    throw new Error(`Invalid MathML <${elementName(node)}> arity`);
  }
  return children;
}

function serializeToken(node: XmlNode, normal = false): string {
  if (childElements(node).length > 0) {
    throw new Error(`Unsupported MathML element: ${elementName(childElements(node)[0])}`);
  }
  return textRun(nodeText(node), normal);
}

function serialize(node: XmlNode): string {
  const name = elementName(node);
  switch (name) {
    case "math":
    case "mrow":
    case "semantics":
    case "annotation-xml":
      return childElements(node).map(serialize).join("");
    case "mi":
    case "mn":
    case "mo":
      return serializeToken(node);
    case "mtext":
      return serializeToken(node, true);
    case "mfrac": {
      const [numerator, denominator] = requireChildren(node, 2);
      return `<m:f><m:num>${serialize(numerator)}</m:num><m:den>${serialize(denominator)}</m:den></m:f>`;
    }
    case "msqrt": {
      const children = childElements(node);
      return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:e>${children
        .map(serialize)
        .join("")}</m:e></m:rad>`;
    }
    case "mroot": {
      const [radicand, degree] = requireChildren(node, 2);
      return `<m:rad><m:deg>${serialize(degree)}</m:deg><m:e>${serialize(radicand)}</m:e></m:rad>`;
    }
    case "msub": {
      const [base, sub] = requireChildren(node, 2);
      return `<m:sSub><m:e>${serialize(base)}</m:e><m:sub>${serialize(sub)}</m:sub></m:sSub>`;
    }
    case "msup": {
      const [base, sup] = requireChildren(node, 2);
      return `<m:sSup><m:e>${serialize(base)}</m:e><m:sup>${serialize(sup)}</m:sup></m:sSup>`;
    }
    case "msubsup": {
      const [base, sub, sup] = requireChildren(node, 3);
      return `<m:sSubSup><m:e>${serialize(base)}</m:e><m:sub>${serialize(sub)}</m:sub><m:sup>${serialize(sup)}</m:sup></m:sSubSup>`;
    }
    case "munder": {
      const [base, under] = requireChildren(node, 2);
      return `<m:limLow><m:e>${serialize(base)}</m:e><m:lim>${serialize(under)}</m:lim></m:limLow>`;
    }
    case "mover": {
      const [base, over] = requireChildren(node, 2);
      return `<m:limUpp><m:e>${serialize(base)}</m:e><m:lim>${serialize(over)}</m:lim></m:limUpp>`;
    }
    case "munderover": {
      const [base, under, over] = requireChildren(node, 3);
      return `<m:nary><m:naryPr><m:limLoc m:val="undOvr"/></m:naryPr><m:sub>${serialize(under)}</m:sub><m:sup>${serialize(over)}</m:sup><m:e>${serialize(base)}</m:e></m:nary>`;
    }
    case "mtable":
      return serializeTable(node);
    case "mtr":
      return `<m:mr>${childElements(node).map(serialize).join("")}</m:mr>`;
    case "mtd":
      return `<m:e>${childElements(node).map(serialize).join("")}</m:e>`;
    case "mfenced":
      return serializeFenced(node);
    default:
      throw new Error(`Unsupported MathML element: ${name}`);
  }
}

function attr(node: XmlNode, name: string, fallback: string): string {
  const value = node.getAttribute?.(name) ?? node.attributes?.[name] ?? null;
  return value === null || value === undefined || value === "" ? fallback : value;
}

function serializeFenced(node: XmlNode): string {
  const children = childElements(node);
  const open = attr(node, "open", "(");
  const close = attr(node, "close", ")");
  const separators = attr(node, "separators", ",");
  const parts = children.map(serialize);
  const separatorRuns = parts.slice(0, -1).map((_, index) => textRun(separators[index] || separators.at(-1) || ","));

  return `${textRun(open)}${parts.flatMap((part, index) => (index < separatorRuns.length ? [part, separatorRuns[index]] : [part])).join("")}${textRun(close)}`;
}

function serializeTable(node: XmlNode): string {
  const rows = childElements(node);
  const rowNodes = rows.map((row) => {
    if (elementName(row) !== "mtr") {
      throw new Error(`Unsupported MathML element: ${elementName(row)}`);
    }
    return serialize(row);
  });
  const columnCount = rows.reduce((maximum, row) => Math.max(maximum, childElements(row).length), 0);

  return `<m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="${columnCount}"/><m:mcJc m:val="center"/></m:mcPr></m:mc></m:mcs></m:mPr>${rowNodes.join("")}</m:m>`;
}

function hasParserError(document: XmlDocument): boolean {
  const visit = (node: XmlNode): boolean => {
    const name = elementName(node).toLowerCase();
    if (name === "parsererror") return true;
    return childElements(node).some(visit);
  };

  return document.documentElement ? visit(document.documentElement) : false;
}

function hasSingleRootAndNoTrailingContent(document: XmlDocument): boolean {
  const root = document.documentElement;
  const children = document.childNodes;
  if (!root || !children) return false;
  let elementCount = 0;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.nodeType === 1) {
      elementCount += 1;
      if (child !== root) return false;
    } else if ((child.nodeType === 3 || child.nodeType === 4) && nodeText(child).trim() !== "") {
      return false;
    }
  }
  return elementCount === 1;
}

function hasOnlyMathmlNamespaces(node: XmlNode): boolean {
  if (node.nodeType === 1 && node.namespaceURI !== MATHML_NAMESPACE) return false;
  return childElements(node).every(hasOnlyMathmlNamespaces);
}

export function mathmlToOmml(mathml: string): string {
  if (mathml.trim() === "") throw new Error("MathML input is blank");

  const document = xmlParser().parseFromString(mathml, "application/xml");
  if (hasParserError(document) || !hasSingleRootAndNoTrailingContent(document)) {
    throw new Error("Invalid MathML XML");
  }

  const root = document.documentElement;
  if (!root || elementName(root) !== "math") {
    throw new Error("MathML document must have a <math> root");
  }
  const namespace = root.namespaceURI ?? root.attributes?.xmlns;
  if (!namespace) {
    throw new Error("MathML document must use the MathML namespace");
  }
  if (namespace !== MATHML_NAMESPACE) {
    throw new Error(`Unexpected MathML namespace: ${namespace}`);
  }
  if (!hasOnlyMathmlNamespaces(root)) throw new Error("Unexpected MathML namespace");

  return `<m:oMath xmlns:m="${OMML_NAMESPACE}">${childElements(root).map(serialize).join("")}</m:oMath>`;
}

export function officeFormulaArguments(omml: string, latex: string): { omml: string; latex: string } {
  return { omml, latex };
}
