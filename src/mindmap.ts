import type { MindmapModel } from "pele";
import { parse, register } from "pele/core";
import mindmap from "pele/diagrams/mindmap";

// Only the mindmap type, so `mmd-viz/mindmap` stays small. pele/core is the
// instance pele/lazy uses too: models from here render there.
register(mindmap);

/**
 * Mind maps from plain Markdown: headings, nested lists and paragraphs become
 * branches (the format markmap reads), drawn by pele's mindmap layout.
 */

export interface OutlineNode {
  /** Stable path id: "0" is the root, "0.2.1" the second child of its third child. */
  id: string;
  /** Inline Markdown of the node (bold, italic, code, strikethrough). */
  content: string;
  children: OutlineNode[];
  /** Folded in the source (`<!-- markmap: fold -->` or `foldAll` above it). */
  folded: boolean;
}

export interface Outline {
  root: OutlineNode;
  /** The frontmatter `title`, if any. */
  title: string | undefined;
}

export interface ParseOutlineOptions {
  /**
   * Label of the root when the text has several top-level items (a single
   * top-level heading or item is the root itself). Defaults to the frontmatter
   * `title`, else an empty root.
   */
  rootLabel?: string;
}

export interface MindmapModelOptions {
  /**
   * Show nodes down to this depth (the root is 0); deeper branches are folded.
   * `-1` (default) shows all, except what the source folds.
   */
  expandLevel?: number;
  /**
   * Per-node overrides by id: `true` folds a node, `false` unfolds it,
   * whatever `expandLevel` and the source say.
   */
  folds?: ReadonlyMap<string, boolean>;
  /** Class given to folded nodes that have hidden children. Defaults to `"mmd-folded"`. */
  foldedClass?: string;
  /** Label of a folded node, e.g. `(text, n) => \`${text} +${n}\``. Defaults to its text. */
  foldedLabel?: (content: string, hiddenCount: number) => string;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const LIST_ITEM = /^([ \t]*)(?:[-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const FOLD_COMMENT = /<!--\s*markmap:\s*(fold|foldAll)\s*-->/gi;

interface Draft {
  content: string;
  children: Draft[];
  folded: boolean;
  foldAll: boolean;
}

/** Splits off a leading `---` YAML block; returns its `title` and the rest. */
function stripFrontmatter(markdown: string): { title: string | undefined; body: string } {
  const match = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
  if (!match) return { title: undefined, body: markdown };
  const titleLine = /^title:[ \t]*(.*)$/m.exec(match[1] ?? "");
  const title = titleLine?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;
  return { title, body: markdown.slice(match[0].length) };
}

function indentWidth(whitespace: string): number {
  let width = 0;
  for (const char of whitespace) width = char === "\t" ? width + 4 - (width % 4) : width + 1;
  return width;
}

/** Inline Markdown pele can draw: links and images become their text, HTML goes. */
export function cleanInline(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/<\/?[A-Za-z][^>]*>/g, "")
    .replace(/^\[ \][ \t]+/, "☐ ")
    .replace(/^\[[xX]\][ \t]+/, "☑ ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Markdown to an outline tree: headings nest by level, list items by
 * indentation (under the heading above them), and paragraphs are leaves.
 * Code blocks, tables and thematic breaks are left out.
 */
export function parseOutline(markdown: string, options: ParseOutlineOptions = {}): Outline {
  const { title, body } = stripFrontmatter(markdown);
  const top: Draft = { content: "", children: [], folded: false, foldAll: false };
  // Open headings, each with the level it was written at.
  const headings: Array<{ level: number; node: Draft }> = [];
  // Open list items under the innermost heading, with their indentation.
  let items: Array<{ indent: number; node: Draft }> = [];
  // What a continuation line or paragraph line appends to.
  let open: Draft | null = null;
  let openIsItem = false;
  let fence: string | null = null;

  const parent = (): Draft => headings.at(-1)?.node ?? top;
  const add = (container: Draft, raw: string): Draft => {
    const node: Draft = { content: "", children: [], folded: false, foldAll: false };
    appendText(node, raw);
    container.children.push(node);
    return node;
  };

  for (const line of body.split(/\r?\n/)) {
    if (fence !== null) {
      if (line.trimStart().startsWith(fence)) fence = null;
      continue;
    }
    const fenceOpen = FENCE.exec(line);
    if (fenceOpen) {
      fence = fenceOpen[1] ?? "```";
      open = null;
      continue;
    }
    if (!line.trim()) {
      // A blank line ends a paragraph; a list item may still continue (indented).
      if (!openIsItem) open = null;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      while ((headings.at(-1)?.level ?? 0) >= level) headings.pop();
      const node = add(parent(), heading[2] ?? "");
      headings.push({ level, node });
      items = [];
      open = null;
      openIsItem = false;
      continue;
    }

    if (THEMATIC_BREAK.test(line) || /^\s*\|/.test(line)) {
      open = null;
      openIsItem = false;
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const indent = indentWidth(item[1] ?? "");
      while ((items.at(-1)?.indent ?? -1) >= indent) items.pop();
      const node = add(items.at(-1)?.node ?? parent(), item[2] ?? "");
      items.push({ indent, node });
      open = node;
      openIsItem = true;
      continue;
    }

    const text = line.replace(/^ {0,3}>[ \t]?/, "");
    const indent = indentWidth(/^[ \t]*/.exec(line)?.[0] ?? "");
    if (open && (!openIsItem || indent > (items.at(-1)?.indent ?? 0))) {
      // A paragraph's next line, or an item's indented continuation.
      appendText(open, text);
      continue;
    }
    // A paragraph: a leaf under the heading (a line left of a list ends the list).
    items = [];
    open = add(parent(), text);
    openIsItem = false;
  }

  let rootDraft: Draft;
  const [only] = top.children;
  if (top.children.length === 1 && only) {
    rootDraft = only;
  } else {
    rootDraft = top;
    top.content = cleanInline(options.rootLabel ?? title ?? "");
  }
  return { root: finish(rootDraft, "0", false), title };
}

function appendText(node: Draft, raw: string) {
  const marks = [...raw.matchAll(FOLD_COMMENT)].map((match) => match[1]?.toLowerCase());
  if (marks.includes("fold")) node.folded = true;
  if (marks.includes("foldall")) node.foldAll = node.folded = true;
  const text = cleanInline(raw);
  if (text) node.content = node.content ? `${node.content} ${text}` : text;
}

function finish(draft: Draft, id: string, foldAll: boolean): OutlineNode {
  const inherited = foldAll || draft.foldAll;
  return {
    id,
    content: draft.content,
    folded: draft.folded || inherited,
    children: draft.children
      // Comment-only lines leave empty nodes behind; their children move up.
      .flatMap((child) => (child.content ? [child] : child.children))
      .map((child, index) => finish(child, `${id}.${index}`, inherited)),
  };
}

/** Whether a node's children are hidden, given the model options. */
export function isFolded(node: OutlineNode, depth: number, options: MindmapModelOptions = {}) {
  const override = options.folds?.get(node.id);
  if (override !== undefined) return override;
  const expandLevel = options.expandLevel ?? -1;
  return node.folded || (expandLevel >= 0 && depth >= expandLevel);
}

/** Number of nodes below a node. */
export function countDescendants(node: OutlineNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

/**
 * The outline as pele's mindmap model, without the branches folded away.
 * Each node's `nodeId` is its outline id, so it shows as `data-id` in the SVG.
 *
 * Pele only renders models its own `parse()` made, so this parses a skeleton
 * (one placeholder node per line) and then sets each node's label, id, shape
 * and class: labels never pass through Mermaid syntax, so nothing in them
 * needs escaping.
 */
export function toMindmapModel(
  outline: Outline,
  options: MindmapModelOptions = {},
): MindmapModel {
  const foldedClass = options.foldedClass ?? "mmd-folded";
  const shown: Array<{ node: OutlineNode; folded: boolean }> = [];
  let skeleton = "mindmap\n";
  const visit = (node: OutlineNode, depth: number) => {
    const folded = node.children.length > 0 && isFolded(node, depth, options);
    shown.push({ node, folded });
    skeleton += `${"  ".repeat(depth + 1)}n${shown.length}["x"]\n`;
    if (!folded) for (const child of node.children) visit(child, depth + 1);
  };
  visit(outline.root, 0);

  const model = parse(skeleton) as MindmapModel;
  model.nodes.forEach((pelesNode, index) => {
    const entry = shown[index];
    if (!entry) return;
    pelesNode.nodeId = entry.node.id;
    pelesNode.descr = options.foldedLabel && entry.folded
      ? options.foldedLabel(entry.node.content, countDescendants(entry.node))
      : entry.node.content;
    // Plain text, a pill when it has children; a folded node keeps the pill look.
    pelesNode.type = entry.folded ? 1 : 0;
    if (entry.folded) pelesNode.class = foldedClass;
  });
  return model;
}

/** Markdown straight to pele's mindmap model. */
export function markdownToMindmap(
  markdown: string,
  options: ParseOutlineOptions & MindmapModelOptions = {},
): MindmapModel {
  return toMindmapModel(parseOutline(markdown, options), options);
}
