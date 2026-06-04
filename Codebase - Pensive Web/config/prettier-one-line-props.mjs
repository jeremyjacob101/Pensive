import * as prettierPluginEstree from "prettier/plugins/estree";
import * as importPlugin from "./prettier-one-line-imports.mjs";
import * as prettier from "prettier";

const basePrinter = prettierPluginEstree.printers.estree;
const importPrinter = importPlugin.printers["imports-estree"];
const { join } = prettier.doc.builders;

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

function isFunctionLikeNode(node) {
  if (!node || typeof node !== "object") {
    return false;
  }

  switch (node.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "ObjectMethod":
    case "ClassMethod":
    case "ClassPrivateMethod":
    case "TSDeclareFunction":
      return true;
    default:
      return false;
  }
}

function isTypedFunctionParamObjectPattern(path, node) {
  if (!node || node.type !== "ObjectPattern") {
    return false;
  }

  const parent = path.getParentNode?.();

  if (!isFunctionLikeNode(parent)) {
    return false;
  }

  if (!Array.isArray(parent.params) || !parent.params.includes(node)) {
    return false;
  }

  return node.typeAnnotation?.typeAnnotation?.type === "TSTypeLiteral";
}

function renderSingleLineFunctionParamObjectPattern(path, node, print) {
  if (hasComments(node) || !Array.isArray(node.properties)) {
    return null;
  }

  const renderedProperties = path.map(print, "properties");

  if (renderedProperties.length !== node.properties.length) {
    return null;
  }

  for (let index = 0; index < node.properties.length; index += 1) {
    const property = node.properties[index];
    const rendered = renderedProperties[index];

    if (hasComments(property) || rendered === undefined || rendered === null) {
      return null;
    }

    if (typeof rendered === "string" && rendered.trim() === "") {
      return null;
    }
  }

  const typeAnnotationDoc = node.typeAnnotation
    ? path.call(print, "typeAnnotation")
    : "";

  return ["{ ", join(", ", renderedProperties), " }", typeAnnotationDoc];
}

function print(path, options, print) {
  const node = path.node;

  if (
    options.singleLineFunctionParamDestructuring &&
    isTypedFunctionParamObjectPattern(path, node)
  ) {
    const forcedParamPattern = renderSingleLineFunctionParamObjectPattern(
      path,
      node,
      print,
    );

    if (forcedParamPattern) {
      return forcedParamPattern;
    }
  }

  return importPrinter.print.call(this, path, options, print);
}

export const options = {
  ...importPlugin.options,
  singleLineFunctionParamDestructuring: {
    type: "boolean",
    category: "Global",
    default: false,
    description:
      "Keep typed function parameter object destructuring on one line when safe.",
  },
};

export const parsers = importPlugin.parsers;

export const printers = {
  "imports-estree": {
    ...basePrinter,
    ...importPrinter,
    print,
  },
};