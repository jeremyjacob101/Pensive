import * as prettierPluginTypeScript from "prettier/plugins/typescript";
import * as prettierPluginEstree from "prettier/plugins/estree";
import * as prettierPluginBabel from "prettier/plugins/babel";
import * as prettier from "prettier";

const { group, hardline } = prettier.doc.builders;
const basePrinter = prettierPluginEstree.printers.estree;

function hasComments(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (
    (Array.isArray(value.comments) && value.comments.length > 0) ||
    (Array.isArray(value.leadingComments) &&
      value.leadingComments.length > 0) ||
    (Array.isArray(value.trailingComments) &&
      value.trailingComments.length > 0) ||
    (Array.isArray(value.innerComments) && value.innerComments.length > 0)
  ) {
    return true;
  }

  for (const key of Object.keys(value)) {
    if (hasComments(value[key], seen)) {
      return true;
    }
  }

  return false;
}

function quoteString(text, options) {
  const quote = options.singleQuote ? "'" : '"';
  return prettier.util.makeString(text, quote, true);
}

function renderImportKindPrefix(kind) {
  if (!kind || kind === "value") {
    return "";
  }

  if (kind === "type" || kind === "typeof") {
    return `${kind} `;
  }

  return null;
}

function renderModuleExportName(node, options) {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (typeof node.name === "string") {
    return {
      bindingName: node.name,
      printed: node.name,
      isStringLiteral: false,
    };
  }

  if (typeof node.value === "string") {
    return {
      bindingName: node.value,
      printed: quoteString(node.value, options),
      isStringLiteral: true,
    };
  }

  return null;
}

function renderImportAttributePart(node, options) {
  const name = renderModuleExportName(node, options);
  return name ? name.printed : null;
}

function renderLiteral(node, options) {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (typeof node.value === "string") {
    return quoteString(node.value, options);
  }

  if (
    typeof node.value === "number" ||
    typeof node.value === "boolean" ||
    node.value === null
  ) {
    return String(node.value);
  }

  if (node.type === "Identifier" && typeof node.name === "string") {
    return node.name;
  }

  if (typeof node.raw === "string") {
    return node.raw;
  }

  return null;
}

function renderImportAttribute(attribute, options) {
  const key = renderImportAttributePart(attribute?.key, options);
  const value = renderLiteral(attribute?.value, options);

  if (!key || value === null) {
    return null;
  }

  return `${key}: ${value}`;
}

function renderImportAttributes(node, options) {
  const attributes = Array.isArray(node.attributes) ? node.attributes : [];
  const assertions = Array.isArray(node.assertions) ? node.assertions : [];

  if (attributes.length > 0 && assertions.length > 0) {
    return null;
  }

  const entries = attributes.length > 0 ? attributes : assertions;

  if (entries.length === 0) {
    return "";
  }

  const keyword = attributes.length > 0 ? " with " : " assert ";
  const rendered = [];

  for (const entry of entries) {
    const part = renderImportAttribute(entry, options);

    if (!part) {
      return null;
    }

    rendered.push(part);
  }

  return `${keyword}{ ${rendered.join(", ")} }`;
}

function renderImportSpecifiers(specifiers, options) {
  let defaultPart = "";
  let namespacePart = "";
  const namedParts = [];

  for (const specifier of specifiers) {
    switch (specifier.type) {
      case "ImportDefaultSpecifier": {
        if (defaultPart || !specifier.local?.name) {
          return null;
        }

        defaultPart = specifier.local.name;
        break;
      }

      case "ImportNamespaceSpecifier": {
        if (namespacePart || namedParts.length > 0 || !specifier.local?.name) {
          return null;
        }

        namespacePart = `* as ${specifier.local.name}`;
        break;
      }

      case "ImportSpecifier": {
        if (namespacePart || !specifier.local?.name) {
          return null;
        }

        const imported = renderModuleExportName(specifier.imported, options);
        const kindPrefix = renderImportKindPrefix(specifier.importKind);

        if (!imported || kindPrefix === null) {
          return null;
        }

        const aliasNeeded =
          imported.isStringLiteral ||
          specifier.local.name !== imported.bindingName;
        const alias = aliasNeeded ? ` as ${specifier.local.name}` : "";

        namedParts.push(`${kindPrefix}${imported.printed}${alias}`);
        break;
      }

      default:
        return null;
    }
  }

  const parts = [];

  if (defaultPart) {
    parts.push(defaultPart);
  }

  if (namespacePart) {
    parts.push(namespacePart);
  }

  if (namedParts.length > 0) {
    parts.push(`{ ${namedParts.join(", ")} }`);
  }

  return parts.join(", ");
}

function renderSingleLineImport(node, options) {
  if (node.type !== "ImportDeclaration") {
    return null;
  }

  if (hasComments(node) || node.phase) {
    return null;
  }

  if (!node.source || typeof node.source.value !== "string") {
    return null;
  }

  const declarationKindPrefix = renderImportKindPrefix(node.importKind);

  if (declarationKindPrefix === null) {
    return null;
  }

  const parts = ["import "];

  if (declarationKindPrefix) {
    if (!Array.isArray(node.specifiers) || node.specifiers.length === 0) {
      return null;
    }

    parts.push(declarationKindPrefix);
  }

  if (Array.isArray(node.specifiers) && node.specifiers.length > 0) {
    const renderedSpecifiers = renderImportSpecifiers(node.specifiers, options);

    if (!renderedSpecifiers) {
      return null;
    }

    parts.push(renderedSpecifiers, " from ");
  }

  parts.push(quoteString(node.source.value, options));

  const renderedAttributes = renderImportAttributes(node, options);

  if (renderedAttributes === null) {
    return null;
  }

  parts.push(renderedAttributes);

  if (options.semi) {
    parts.push(";");
  }

  return parts.join("");
}

function renderSingleLineImportDoc(node, options) {
  const text = renderSingleLineImport(node, options);
  return text ? group([text]) : null;
}

function reorderTopImportsByLength(ast, options) {
  if (
    !ast ||
    ast.type !== "Program" ||
    !Array.isArray(ast.body) ||
    ast.body.length === 0
  ) {
    return ast;
  }

  const topImports = [];

  for (let index = 0; index < ast.body.length; index += 1) {
    const node = ast.body[index];

    if (node?.type !== "ImportDeclaration") {
      break;
    }

    const rendered = renderSingleLineImport(node, options);

    if (!rendered) {
      return ast;
    }

    topImports.push({
      node,
      length: rendered.length,
    });
  }

  if (topImports.length < 2) {
    return ast;
  }

  const sortedImports = [...topImports]
    .map((entry, entryIndex) => ({
      ...entry,
      originalIndex: entryIndex,
    }))
    .sort((left, right) => {
      if (right.length !== left.length) {
        return right.length - left.length;
      }

      return left.originalIndex - right.originalIndex;
    });

  const reorderedBody = [...ast.body];
  let offsetCursor =
    typeof sortedImports[0].node?.start === "number"
      ? sortedImports[0].node.start
      : null;
  let lineCursor = sortedImports[0].node?.loc?.start?.line ?? null;

  for (let index = 0; index < sortedImports.length; index += 1) {
    const sourceNode = sortedImports[index].node;
    let nextNode = sourceNode;

    if (offsetCursor !== null || lineCursor !== null) {
      nextNode = { ...sourceNode };

      if (
        offsetCursor !== null &&
        typeof sourceNode.start === "number" &&
        typeof sourceNode.end === "number" &&
        sourceNode.end >= sourceNode.start
      ) {
        const spanLength = sourceNode.end - sourceNode.start;
        nextNode.start = offsetCursor;
        nextNode.end = offsetCursor + spanLength;
        offsetCursor = nextNode.end + 1;

        if (Array.isArray(sourceNode.range) && sourceNode.range.length === 2) {
          nextNode.range = [nextNode.start, nextNode.end];
        }
      }

      if (lineCursor !== null && sourceNode.loc?.start && sourceNode.loc?.end) {
        const lineSpan = Math.max(
          sourceNode.loc.end.line - sourceNode.loc.start.line,
          0,
        );
        nextNode.loc = {
          ...sourceNode.loc,
          start: { ...sourceNode.loc.start, line: lineCursor },
          end: { ...sourceNode.loc.end, line: lineCursor + lineSpan },
        };
        lineCursor = nextNode.loc.end.line + 1;
      }
    }

    reorderedBody[index] = nextNode;
  }

  return { ...ast, body: reorderedBody };
}

function hasBlankLineBetween(previousNode, nextNode) {
  if (!previousNode?.loc || !nextNode?.loc) {
    return false;
  }

  return nextNode.loc.start.line > previousNode.loc.end.line + 1;
}

function print(path, options, print) {
  const node = path.node;

  if (
    options.singleLineImports &&
    node?.type === "Program" &&
    Array.isArray(node.body)
  ) {
    let topImportCount = 0;
    const forcedTopImports = [];

    for (const bodyNode of node.body) {
      if (bodyNode?.type !== "ImportDeclaration") {
        break;
      }

      const forcedImport = renderSingleLineImportDoc(bodyNode, options);

      if (!forcedImport) {
        return basePrinter.print.call(this, path, options, print);
      }

      forcedTopImports.push(forcedImport);
      topImportCount += 1;
    }

    if (topImportCount > 0) {
      const docs = [];

      for (let index = 0; index < node.body.length; index += 1) {
        const currentNode = node.body[index];
        const nextNode = node.body[index + 1];
        const currentDoc =
          index < topImportCount
            ? forcedTopImports[index]
            : path.call(print, "body", index);

        docs.push(currentDoc);

        if (!nextNode) {
          continue;
        }

        let separatorCount = 1;

        if (index === topImportCount - 1) {
          separatorCount = 2;
        } else if (index >= topImportCount) {
          separatorCount = hasBlankLineBetween(currentNode, nextNode) ? 2 : 1;
        }

        for (
          let separatorIndex = 0;
          separatorIndex < separatorCount;
          separatorIndex += 1
        ) {
          docs.push(hardline);
        }
      }

      return docs;
    }
  }

  if (options.singleLineImports && node?.type === "ImportDeclaration") {
    const forcedImport = renderSingleLineImportDoc(node, options);

    if (forcedImport) {
      return forcedImport;
    }
  }

  return basePrinter.print.call(this, path, options, print);
}

export const options = {
  singleLineImports: {
    type: "boolean",
    category: "Global",
    default: false,
    description: "Keep safe import declarations on a single line.",
  },
  sortTopImportsByLength: {
    type: "boolean",
    category: "Global",
    default: false,
    description:
      "Sort the top consecutive import block by descending one-line character count.",
  },
};

export const parsers = {
  "imports-babel": {
    ...prettierPluginBabel.parsers.babel,
    astFormat: "imports-estree",
  },
  "imports-babel-ts": {
    ...prettierPluginBabel.parsers["babel-ts"],
    astFormat: "imports-estree",
  },
  "imports-typescript": {
    ...prettierPluginTypeScript.parsers.typescript,
    astFormat: "imports-estree",
  },
};

export const printers = {
  "imports-estree": {
    ...basePrinter,
    preprocess: (ast, options) => {
      const nextAst =
        typeof basePrinter.preprocess === "function"
          ? basePrinter.preprocess(ast, options)
          : ast;

      if (!options.sortTopImportsByLength) {
        return nextAst;
      }

      return reorderTopImportsByLength(nextAst, options);
    },
    print,
  },
};