import { renderAnimatedSvg } from "./animate.js";
import {
  markdownToMindmap,
  type MindmapModelOptions,
  type ParseOutlineOptions,
} from "./mindmap.js";
import type { AnimateOptions } from "./themes.js";

/**
 * A Markdown outline as a themed mind map SVG (see `renderAnimatedSvg` for the
 * options). With animation on, branches grow out of the root once.
 */
export function renderMindmapSvg(
  markdown: string,
  options: AnimateOptions & ParseOutlineOptions & MindmapModelOptions = {},
): string {
  return renderAnimatedSvg(markdownToMindmap(markdown, options), options);
}
