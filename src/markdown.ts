import type { Element, ElementContent, Root as HastRoot, RootContent } from "hast";
import type { Root as MdastRoot, RootContent as MdastContent } from "mdast";
import { renderAnimatedSvg } from "./animate.js";
import { renderMindmapSvg } from "./mindmap-svg.js";
import { THEME_NAMES, type AnimateOptions, type ThemeName } from "./themes.js";

/**
 * Markdown pipelines (unified: remark, rehype, MDX, Astro, Docusaurus, …):
 * ```mermaid blocks become mmd-viz's animated SVGs and ```markmap blocks mind
 * maps, at build time, with no browser. pele lays them out synchronously.
 *
 * Each diagram is an `<img>` with the SVG as a data URL by default: its CSS
 * stays its own (two SVGs inlined in one page would share their class rules)
 * and its animation still plays. `as: "svg"` inlines the SVG instead.
 *
 * Options apply to every block; a block's fence can override them:
 * ```mermaid theme=light title="Login flow" static
 */

export interface MarkdownDiagramOptions extends AnimateOptions {
  /** `img` (default): an `<img>` with a data URL. `svg`: the SVG inline. */
  as?: "img" | "svg";
  /** Fence languages drawn as Mermaid diagrams. Defaults to `["mermaid"]`. */
  mermaid?: readonly string[];
  /** Fence languages drawn as mind maps from a Markdown outline. Defaults to `["markmap"]`. */
  mindmap?: readonly string[];
  /** Class of the `<img>` / wrapper. Defaults to `"mmd-viz"`. */
  className?: string;
  /**
   * What to do with a block that doesn't render: `keep` (default) leaves the
   * code block as it is, `throw` fails the build.
   */
  onError?: "keep" | "throw" | ((error: unknown, source: string) => void);
}

/** One rendered block: the SVG and how to show it. */
interface Drawn {
  svg: string;
  alt: string;
}

const BOOLEAN_META = new Set(["static", "transparent"]);

/** Fence meta (`theme=light title="Login flow" static`) as options. */
export function parseMeta(meta: string | null | undefined): Partial<AnimateOptions> {
  const options: Partial<AnimateOptions> = {};
  if (!meta) return options;
  for (const match of meta.matchAll(/([a-zA-Z-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g)) {
    const key = match[1] ?? "";
    const value = match[2] ?? match[3] ?? match[4];
    if (value === undefined) {
      if (key === "static") options.animate = false;
      else if (BOOLEAN_META.has(key)) options.transparent = true;
      continue;
    }
    if (key === "theme" && (THEME_NAMES as readonly string[]).includes(value)) {
      options.theme = value as ThemeName;
    } else if (key === "title") options.title = value;
    else if (key === "footer") options.footer = value;
    else if (key === "alt") options.ariaLabel = value;
    else if (key === "speed" && Number.isFinite(Number(value))) options.speed = Number(value);
  }
  return options;
}

let blocks = 0;

function draw(
  lang: string,
  source: string,
  meta: string | null | undefined,
  options: MarkdownDiagramOptions
): Drawn | null {
  const mermaid = options.mermaid ?? ["mermaid"];
  const mindmap = options.mindmap ?? ["markmap"];
  const isMindmap = mindmap.includes(lang);
  if (!isMindmap && !mermaid.includes(lang)) return null;
  const { as: _as, mermaid: _m, mindmap: _mm, className: _c, onError, ...base } = options;
  const blockOptions: AnimateOptions = {
    ...base,
    ...parseMeta(meta),
    idPrefix: `${base.idPrefix ?? "mmd"}${++blocks}`,
  };
  try {
    const svg = isMindmap
      ? renderMindmapSvg(source, blockOptions)
      : renderAnimatedSvg(source, blockOptions);
    const alt = blockOptions.ariaLabel ?? blockOptions.title ?? (isMindmap ? "Mind map" : "Diagram");
    return { svg, alt };
  } catch (error) {
    if (onError === "throw") throw error;
    if (typeof onError === "function") onError(error, source);
    return null;
  }
}

const dataUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

function svgSize(svg: string): { width?: string; height?: string } {
  const open = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const width = /\swidth="(\d+(?:\.\d+)?)"/.exec(open)?.[1];
  const height = /\sheight="(\d+(?:\.\d+)?)"/.exec(open)?.[1];
  return { ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

const escapeAttribute = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/** The block as an HTML string (remark: an `html` node). */
function toHtml({ svg, alt }: Drawn, options: MarkdownDiagramOptions): string {
  const className = escapeAttribute(options.className ?? "mmd-viz");
  if (options.as === "svg") return `<div class="${className}">${svg}</div>`;
  const { width, height } = svgSize(svg);
  const size = `${width ? ` width="${width}"` : ""}${height ? ` height="${height}"` : ""}`;
  return `<img class="${className}" src="${escapeAttribute(dataUrl(svg))}" alt="${escapeAttribute(alt)}"${size}>`;
}

/** The block as a hast node (rehype). Inline SVG goes in as a `raw` node. */
function toHast(drawn: Drawn, options: MarkdownDiagramOptions): ElementContent | RootContent {
  const className = options.className ?? "mmd-viz";
  if (options.as === "svg") {
    return {
      type: "element",
      tagName: "div",
      properties: { className: [className] },
      // rehype-stringify writes it with `allowDangerousHtml`, rehype-raw parses it
      children: [{ type: "raw", value: drawn.svg } as unknown as ElementContent],
    };
  }
  return {
    type: "element",
    tagName: "img",
    properties: {
      className: [className],
      src: dataUrl(drawn.svg),
      alt: drawn.alt,
      ...svgSize(drawn.svg),
    },
    children: [],
  };
}

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** `language-mermaid` → `mermaid`. */
function fenceLanguage(code: Element): string | undefined {
  const classes = code.properties.className;
  const list: unknown[] = Array.isArray(classes) ? classes : String(classes ?? "").split(" ");
  for (const name of list) {
    if (typeof name === "string" && name.startsWith("language-")) return name.slice("language-".length);
  }
  return undefined;
}

/**
 * rehype: `<pre><code class="language-mermaid">` (and `language-markmap`)
 * become animated diagrams. Use after remark-rehype, before syntax
 * highlighters (which would color the source first).
 */
export function rehypeMmdViz(options: MarkdownDiagramOptions = {}) {
  return (tree: HastRoot) => {
    const visit = (parent: HastRoot | Element) => {
      parent.children.forEach((child, index) => {
        if (child.type !== "element") return;
        const [code] = child.children;
        if (child.tagName === "pre" && child.children.length === 1 && code?.type === "element" && code.tagName === "code") {
          const lang = fenceLanguage(code);
          const meta = (code.data as { meta?: string } | undefined)?.meta;
          const drawn = lang ? draw(lang, textOf(code), meta, options) : null;
          if (drawn) {
            parent.children[index] = toHast(drawn, options) as Element;
            return;
          }
        }
        visit(child);
      });
    };
    visit(tree);
  };
}

/**
 * remark: ```mermaid (and ```markmap) code blocks become `html` nodes with
 * the diagram, for pipelines that stay in Markdown (remark-html, remark-stringify).
 */
export function remarkMmdViz(options: MarkdownDiagramOptions = {}) {
  return (tree: MdastRoot) => {
    const visit = (parent: { children: MdastContent[] }) => {
      parent.children.forEach((child, index) => {
        if (child.type === "code" && child.lang) {
          const drawn = draw(child.lang, child.value, child.meta, options);
          if (drawn) {
            parent.children[index] = { type: "html", value: toHtml(drawn, options) };
            return;
          }
        }
        if ("children" in child) visit(child as { children: MdastContent[] });
      });
    };
    visit(tree);
  };
}
