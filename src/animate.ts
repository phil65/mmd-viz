import type { DiagramModel } from "pele";
import { render } from "pele/core";
import "./diagrams.js";
import { applyMotion, clampSpeed, DEFAULT_ACCENT, sanitizeIdPrefix } from "./motion.js";
import { THEMES, type AnimateOptions, type ThemePalette } from "./themes.js";

/**
 * Render a Mermaid diagram via Pele and upgrade it into a self-contained,
 * zero-JS styled & animated SVG (compatible with GitHub READMEs and static docs).
 *
 * Supported standard Mermaid conventions:
 * - `:::cyan`, `:::indigo`, `:::amber`, `:::emerald`, `:::pink`, `:::rose`, `:::violet`
 *   adds a colored accent bar to a node and color-matches its connected edges and packets.
 * - `:::hub` styles a node as a highlighted focal hub with a gradient fill and pulsing ring.
 * - `<br/>` in node labels creates a bold primary title + muted secondary subtitle.
 * - `==>` (thick) and `-.->` (dotted) edges adjust wire weight and packet speed.
 */
export function renderAnimatedSvg(
  mermaidSource: string | DiagramModel,
  options: AnimateOptions = {}
): string {
  const themeName = options.theme ?? "dark";
  const isAuto = themeName === "auto";
  const palette: ThemePalette = isAuto ? THEMES.dark : THEMES[themeName];
  const lightPalette: ThemePalette = THEMES.light;

  const animate = options.animate ?? true;
  const transparent = options.transparent ?? false;
  const speed = clampSpeed(options.speed ?? 1);
  const padX = options.padding ?? 52;
  const padTop = options.title ? 76 : 48;
  const padBottom = options.footer ? 76 : 48;
  const pfx = sanitizeIdPrefix(options.idPrefix ?? "mmd");

  const { svg: rawSvg, width, height, type: diagramType } = render(mermaidSource);

  const innerMatch = rawSvg.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/);
  if (!innerMatch || innerMatch[1] === undefined) {
    throw new Error("Unexpected SVG output from pele.");
  }
  let inner = innerMatch[1];

  const isMindmap = diagramType === "mindmap";
  const motion = applyMotion(inner, {
    type: diagramType,
    pfx,
    speed,
    animate,
    style: "framed",
    wireBaseOpacity: palette.wireBaseOpacity,
  });
  inner = motion.inner;
  const extraDefs = motion.defs;

  // 3. Wrap into final padded canvas with CSS-variable themes
  const minTitleW = options.title ? Math.ceil(options.title.length * 10.2 + 64) : 0;
  const minFooterW = options.footer ? Math.ceil(options.footer.length * 7.8 + 96) : 0;
  const totalW = Math.round(Math.max(width + padX * 2, minTitleW, minFooterW));
  const totalH = Math.round(height + padTop + padBottom);
  const offsetX = Math.round((totalW - width) / 2);
  const label = options.ariaLabel ?? options.title ?? "Animated Mermaid Diagram";

  const titleEl = options.title
    ? `<text x="${totalW / 2}" y="42" text-anchor="middle" class="${pfx}-title">${escapeXml(options.title)}</text>`
    : "";

  const footerPillWidth = options.footer
    ? Math.min(totalW - 64, Math.max(300, options.footer.length * 7.8 + 48))
    : 0;

  const footerEl = options.footer
    ? [
        `<rect x="${Math.round(totalW / 2 - footerPillWidth / 2)}" y="${totalH - 52}" width="${Math.round(footerPillWidth)}" height="30" rx="15" class="${pfx}-card"/>`,
        `<text x="${totalW / 2}" y="${totalH - 33}" text-anchor="middle" class="${pfx}-footer">${escapeXml(options.footer)}</text>`,
      ].join("\n  ")
    : "";

  // Flowcharts: a bold title line over a muted subtitle. Mind maps: pele's Markdown labels
  // as they are, and eight branch colors.
  const labelCss = isMindmap
    ? `
      .${pfx}-stage { --pele-series-1: #38BDF8; --pele-series-2: #818CF8; --pele-series-3: #FBBF24; --pele-series-4: #34D399; --pele-series-5: #F472B6; --pele-series-6: #FB7185; --pele-series-7: #A78BFA; --pele-series-8: #2DD4BF; }
      .pele-root .pele-label { font-weight: 600; }`
    : `
      .pele-label tspan:first-child { font-size: 14.5px; font-weight: 700; fill: var(--mv-fg); }
      .pele-label tspan:nth-child(n+2) { font-size: 11.5px; font-weight: 400; fill: var(--mv-muted); }`;
  // gitGraph branch labels sit on colored pills; mind maps use pele-branch for whole branches
  const branchCss = isMindmap
    ? ""
    : `      .pele-branch .pele-label { font-size: 12px; font-weight: 700; fill: #070B14; }`;
  const autoLightCss = isAuto
    ? `
      @media (prefers-color-scheme: light) {
        .${pfx}-root {
          --mv-bg: ${lightPalette.bg};
          --mv-card: ${lightPalette.cardFill};
          --mv-border: ${lightPalette.cardStroke};
          --mv-fg: ${lightPalette.textPrimary};
          --mv-muted: ${lightPalette.textMuted};
          --mv-title: ${lightPalette.titleColor};
          --mv-dot: ${lightPalette.dotColor};
          --mv-hub-start: ${lightPalette.hubBgStart};
          --mv-hub-end: ${lightPalette.hubBgEnd};
        }
      }`
    : "";

  const backgroundEls = transparent
    ? ""
    : `
  <rect width="${totalW}" height="${totalH}" rx="18" class="${pfx}-bg"/>
  <rect width="${totalW}" height="${totalH}" rx="18" fill="url(#${pfx}-dots)"/>
  <circle cx="${Math.round(totalW * 0.26)}" cy="${Math.round(totalH * 0.36)}" r="${Math.round(totalW * 0.28)}" fill="url(#${pfx}-glow-l)"/>
  <circle cx="${Math.round(totalW * 0.74)}" cy="${Math.round(totalH * 0.64)}" r="${Math.round(totalW * 0.28)}" fill="url(#${pfx}-glow-r)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" class="${pfx}-root" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <style>
      .${pfx}-root {
        --mv-bg: ${palette.bg};
        --mv-card: ${palette.cardFill};
        --mv-border: ${palette.cardStroke};
        --mv-fg: ${palette.textPrimary};
        --mv-muted: ${palette.textMuted};
        --mv-title: ${palette.titleColor};
        --mv-dot: ${palette.dotColor};
        --mv-hub-start: ${palette.hubBgStart};
        --mv-hub-end: ${palette.hubBgEnd};
        --pele-series-1: #38BDF8;
        --pele-series-2: #818CF8;
        --pele-series-3: #FBBF24;
        --pele-series-4: #34D399;
        --pele-series-5: #F472B6;
      }${autoLightCss}
      .${pfx}-bg { fill: var(--mv-bg); }
      .${pfx}-card { fill: var(--mv-card); stroke: var(--mv-border); stroke-width: 1.2; }
      .${pfx}-dot { fill: var(--mv-dot); }
      .${pfx}-title { font: 700 13px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 2px; fill: var(--mv-title); text-transform: uppercase; }
      .${pfx}-footer { font: 500 12px ui-monospace, SFMono-Regular, Menlo, monospace; fill: var(--mv-muted); }
      .${pfx}-stage { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; fill: var(--mv-fg); }
      .pele-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; fill: var(--mv-fg); }${labelCss}
      .pele-cluster-label { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; fill: var(--mv-muted); }
      .pele-edge-label rect { fill: var(--mv-card); stroke: var(--mv-border); stroke-width: 1; rx: 6; }
      .pele-edge-label text { font-size: 12px; font-weight: 600; fill: var(--mv-fg); }
${branchCss}
      .pele-task .pele-label { font-size: 12px; font-weight: 700; fill: var(--mv-fg); }
      .pele-task .pele-label[fill] { fill: #070B14; }
      .pele-commit-label text { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; fill: var(--mv-muted); }
      .${pfx}-hub-node .pele-label tspan:first-child { font-size: 16px; font-weight: 700; fill: var(--mv-fg); }
      .${pfx}-hub-node .pele-label tspan:nth-child(2) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; fill: var(--mv-title); }${motion.css}
    </style>
    <pattern id="${pfx}-dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1" class="${pfx}-dot"/>
    </pattern>
    <radialGradient id="${pfx}-glow-l" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette.glowLeft}" stop-opacity="${palette.glowOpacity}"/>
      <stop offset="100%" stop-color="${palette.glowLeft}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${pfx}-glow-r" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette.glowRight}" stop-opacity="${palette.glowOpacity}"/>
      <stop offset="100%" stop-color="${palette.glowRight}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${pfx}-hub-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--mv-hub-start)"/>
      <stop offset="100%" stop-color="var(--mv-hub-end)"/>
    </linearGradient>${extraDefs.length > 0 ? `\n    ${extraDefs.join("\n    ")}` : ""}
  </defs>
${backgroundEls}
  ${titleEl}

  <g class="${pfx}-stage" transform="translate(${offsetX},${padTop})" style="--_bg:var(--mv-bg);--_fg:var(--mv-fg);--_m:var(--mv-muted);--_l:${DEFAULT_ACCENT};--_s:var(--mv-card);--_a:var(--mv-hub-start);--_b:var(--mv-border);--_c:${DEFAULT_ACCENT};--_r:12px;--_w:700;--_hw:700;--_tw:700">
    ${inner}
  </g>

  ${footerEl}
</svg>
`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
