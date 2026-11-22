import { applyMotion, clampSpeed, sanitizeIdPrefix } from "./motion.js";

/**
 * mmd-viz's animation for an SVG that pele already drew, inside an app: the
 * drawing stays as pele made it (its colors follow the page through
 * `--pele-*` variables), only the motion of its diagram type is added. Needs
 * nothing from pele itself, so a host that renders with `pele/lazy` keeps
 * loading diagram types on demand.
 */

export interface AnimateSvgOptions {
  /** Prefix for the added classes, keyframes and ids: unique per SVG on a page. */
  idPrefix?: string;
  /** Speed multiplier (`2` is twice as fast). */
  speed?: number;
}

/**
 * Types whose animation keeps running (packets, relays, markers). The others
 * build up once and then stand still, so a host only needs to pause these
 * while they're out of view.
 */
const ONCE = new Set([
  "class",
  "er",
  "requirement",
  "wardley",
  "pie",
  "xychart",
  "radar",
  "quadrantChart",
  "treemap",
  "venn",
  "kanban",
  "packet",
  "treeView",
  "cynefin",
  "info",
  "mindmap",
]);

/** Whether a type's animation loops (`false`: it builds up once). */
export function loops(type: string): boolean {
  return !ONCE.has(type);
}

/** The SVG pele rendered for `type` (`RenderResult.type`), with its animation added. */
export function animateSvg(svg: string, type: string, options: AnimateSvgOptions = {}): string {
  const match = /^\s*(<svg\b[^>]*>)([\s\S]*)<\/svg>\s*$/.exec(svg);
  if (!match?.[1] || match[2] === undefined) throw new Error("Expected an <svg> element.");
  const motion = applyMotion(match[2], {
    type,
    pfx: sanitizeIdPrefix(options.idPrefix ?? "mmd"),
    speed: clampSpeed(options.speed ?? 1),
    animate: true,
    style: "embed",
  });
  const defs = motion.css || motion.defs.length
    ? `<defs><style>${motion.css}</style>${motion.defs.join("")}</defs>`
    : "";
  return `${match[1]}${defs}${motion.inner}</svg>`;
}
