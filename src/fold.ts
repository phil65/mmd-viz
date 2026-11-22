/**
 * Folding for diagrams that are trees or have compartments: a folder in a
 * `treeView-beta` hides its entries, a class in a `classDiagram` its
 * members. It works on the Mermaid source: the host draws the folded source
 * again (with pele, renderAnimatedSvg or animateSvg) and maps a clicked node
 * back to what it folds with `keyAt`. Mind maps fold through their outline
 * (`markdownToMindmap`'s `folds`).
 */

export interface FoldOptions {
  /** Label of a folded tree entry. Defaults to `text (+n)`. */
  treeLabel?: (text: string, hidden: number) => string;
  /** The line standing in for a folded class's members. Defaults to `⋯ n members`. */
  membersLabel?: (hidden: number) => string;
}

export interface Folded {
  /** The source with the folded parts left out. */
  source: string;
  /** What can fold, by key, with how many entries or members it hides. */
  foldable: ReadonlyMap<string, number>;
  /**
   * The key of the `index`-th node drawn (`g.pele-node`, in document order)
   * with `data-id` `id`, or `null` when it can't fold.
   */
  keyAt(index: number, id: string): string | null;
}

/** Types `fold` handles. */
export function canFold(type: string): boolean {
  return type === "treeView" || type === "class";
}

/** The source with the parts keyed in `folded` folded away; `null` for other types. */
export function fold(
  source: string,
  type: string,
  folded: ReadonlySet<string> = new Set(),
  options: FoldOptions = {}
): Folded | null {
  if (type === "treeView") return foldTree(source, folded, options);
  if (type === "class") return foldClasses(source, folded, options);
  return null;
}

const indentOf = (line: string) => /^[ \t]*/.exec(line)?.[0].replace(/\t/g, "    ").length ?? 0;

/** Tree entries are keyed by their source line (`L4`): names repeat (`index.ts`). */
function foldTree(source: string, folded: ReadonlySet<string>, options: FoldOptions): Folded {
  const label = options.treeLabel ?? ((text, hidden) => `${text} (+${hidden})`);
  const lines = source.split("\n");
  const header = lines.findIndex((line) => /^\s*treeView-beta\b/.test(line));
  // Entries: non-empty lines after the header that aren't comments
  const entries: number[] = [];
  for (let i = header + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() && !line.trim().startsWith("%%")) entries.push(i);
  }
  const descendants = new Map<number, number>();
  entries.forEach((line, at) => {
    const indent = indentOf(lines[line] ?? "");
    let count = 0;
    for (const next of entries.slice(at + 1)) {
      if (indentOf(lines[next] ?? "") <= indent) break;
      count++;
    }
    if (count > 0) descendants.set(line, count);
  });

  const out: string[] = [];
  const drawn: number[] = [];
  let skipBelow: number | null = null;
  lines.forEach((line, index) => {
    const isEntry = index > header && line.trim() !== "" && !line.trim().startsWith("%%");
    if (skipBelow !== null && isEntry) {
      if (indentOf(line) > skipBelow) return;
      skipBelow = null;
    }
    if (!isEntry) {
      out.push(line);
      return;
    }
    drawn.push(index);
    const hidden = descendants.get(index);
    if (hidden !== undefined && folded.has(`L${index}`)) {
      skipBelow = indentOf(line);
      // A label goes before any `:::class` or trailing comment the entry has
      const at = line.search(/\s*(:::|%%)/);
      const [text, rest] = at >= 0 ? [line.slice(0, at), line.slice(at)] : [line, ""];
      const indent = /^[ \t]*/.exec(text)?.[0] ?? "";
      out.push(`${indent}${label(text.trim(), hidden)}${rest}`);
    } else {
      out.push(line);
    }
  });

  const foldable = new Map<string, number>();
  for (const [line, count] of descendants) foldable.set(`L${line}`, count);
  return {
    source: out.join("\n"),
    foldable,
    keyAt: (index) => {
      const line = drawn[index];
      return line !== undefined && descendants.has(line) ? `L${line}` : null;
    },
  };
}

const CLASS_BLOCK = /^(\s*)class\s+([\w-]+)(?:~[^~]*~)?(?:\["[^"]*"\])?\s*\{\s*$/;
// `Name : member`; a relation (`A <|-- B : label`, `A--B : x`) has no bare name before its colon
const MEMBER_LINE = /^\s*(\w+(?:-\w+)*)\s*:\s*(.+)$/;
const ANNOTATION = /^\s*<<[^>]+>>\s*$/;

/** Classes are keyed by their name, which is also their `data-id`. */
function foldClasses(source: string, folded: ReadonlySet<string>, options: FoldOptions): Folded {
  const label = options.membersLabel ?? ((hidden) => `⋯ ${hidden} members`);
  const lines = source.split("\n");

  // Members per class: lines in `class X { … }` blocks and `X : member` lines
  const members = new Map<string, number>();
  const add = (name: string) => members.set(name, (members.get(name) ?? 0) + 1);
  let inBlock: string | null = null;
  for (const line of lines) {
    if (inBlock !== null) {
      if (/^\s*\}\s*$/.test(line)) inBlock = null;
      else if (line.trim() && !ANNOTATION.test(line)) add(inBlock);
      continue;
    }
    const block = CLASS_BLOCK.exec(line);
    if (block?.[2]) {
      inBlock = block[2];
      continue;
    }
    const member = MEMBER_LINE.exec(line);
    if (member?.[1]) add(member[1]);
  }

  const out: string[] = [];
  const placed = new Set<string>();
  const placeholder = (name: string, indent: string) => {
    placed.add(name);
    return `${indent}${label(members.get(name) ?? 0)}`;
  };
  inBlock = null;
  let blockIndent = "";
  for (const line of lines) {
    if (inBlock !== null) {
      if (/^\s*\}\s*$/.test(line)) {
        if (folded.has(inBlock) && !placed.has(inBlock)) out.push(placeholder(inBlock, `${blockIndent}  `));
        out.push(line);
        inBlock = null;
      } else if (!folded.has(inBlock) || ANNOTATION.test(line)) {
        out.push(line);
      }
      continue;
    }
    const block = CLASS_BLOCK.exec(line);
    if (block?.[2]) {
      inBlock = block[2];
      blockIndent = block[1] ?? "";
      out.push(line);
      continue;
    }
    const member = MEMBER_LINE.exec(line);
    const name = member?.[1];
    if (name && members.has(name) && folded.has(name)) {
      // The first `X : member` line of a folded class (without a block) says how many
      if (!placed.has(name) && !hasBlock(lines, name)) {
        out.push(`${/^\s*/.exec(line)?.[0] ?? ""}${name} : ${label(members.get(name) ?? 0)}`);
        placed.add(name);
      }
      continue;
    }
    out.push(line);
  }

  return {
    source: out.join("\n"),
    foldable: members,
    keyAt: (_index, id) => (members.has(id) ? id : null),
  };
}

function hasBlock(lines: readonly string[], name: string): boolean {
  return lines.some((line) => CLASS_BLOCK.exec(line)?.[2] === name);
}
