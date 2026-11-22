import { render } from "pele";
import { ACCENT_PALETTE, THEMES, type AnimateOptions } from "./themes.js";

const DEFAULT_ACCENT = "#38BDF8";
const CYCLE_ACCENTS = ["#38BDF8", "#818CF8", "#FBBF24", "#34D399", "#F472B6"] as const;

/**
 * Render a Mermaid diagram via Pele and upgrade it into a self-contained,
 * zero-JS animated SVG (compatible with GitHub READMEs and static docs).
 *
 * Supported standard Mermaid conventions:
 * - `:::cyan`, `:::indigo`, `:::amber`, `:::emerald`, `:::pink`, `:::rose`, `:::violet`
 *   adds a colored accent bar to a node and color-matches its connected edges and packets.
 * - `:::hub` styles a node as a highlighted focal hub with a gradient fill and pulsing ring.
 * - `<br/>` in node labels creates a bold primary title + muted secondary subtitle.
 */
export function renderAnimatedSvg(
  mermaidSource: string,
  options: AnimateOptions = {}
): string {
  const themeName = options.theme ?? "dark";
  const palette = THEMES[themeName];
  const animate = options.animate ?? true;
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

  // 1. Inspect and upgrade flowchart/graph nodes
  const nodeColor = new Map<string, string>();
  const nodeIsHub = new Set<string>();
  const nodeRegex =
    /<g class="pele-node([^"]*)" data-id="([^"]+)" transform="translate\(([^,]+),([^)]+)\)">([\s\S]*?)<\/g>/g;

  inner = inner.replace(
    nodeRegex,
    (_full, classes: string, nodeId: string, tx: string, ty: string, body: string) => {
      const classList = classes.trim().split(/\s+/).filter(Boolean);
      const matchedClass = classList.find((c) => c in ACCENT_PALETTE);
      const color = matchedClass ? (ACCENT_PALETTE[matchedClass] ?? DEFAULT_ACCENT) : DEFAULT_ACCENT;
      const isHub = classList.includes("hub");
      nodeColor.set(nodeId, color);
      if (isHub) nodeIsHub.add(nodeId);

      const rectMatch = body.match(
        /<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"([^>]*)\/>/
      );
      let upgradedBody = body;

      if (rectMatch && rectMatch[1] && rectMatch[2] && rectMatch[3] && rectMatch[4]) {
        const rx = Number.parseFloat(rectMatch[1]);
        const ry = Number.parseFloat(rectMatch[2]);
        const rw = Number.parseFloat(rectMatch[3]);
        const rh = Number.parseFloat(rectMatch[4]);

        if (isHub) {
          const pulseClass = animate ? ` class="${pfx}-pulse"` : "";
          const pulseRect = `<rect x="${(rx - 7).toFixed(1)}" y="${(ry - 7).toFixed(1)}" width="${(rw + 14).toFixed(1)}" height="${(rh + 14).toFixed(1)}" rx="24" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="1.5"${pulseClass}/>`;
          const hubRect = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="18" fill="url(#${pfx}-hub-bg)" stroke="${color}" stroke-opacity="0.65" stroke-width="1.6"/>`;
          upgradedBody = upgradedBody.replace(rectMatch[0], `${pulseRect}${hubRect}`);
        } else {
          const cardRect = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="12" fill="${palette.cardFill}" stroke="${palette.cardStroke}" stroke-width="1.2"/>`;
          const barH = Math.max(20, rh - 26);
          const barY = ry + (rh - barH) / 2;
          const accentBar = `<rect x="${(rx + 10).toFixed(1)}" y="${barY.toFixed(1)}" width="5" height="${barH.toFixed(1)}" rx="2.5" fill="${color}"/>`;
          upgradedBody = upgradedBody.replace(rectMatch[0], `${cardRect}${accentBar}`);
        }
      }

      const hubClass = isHub ? ` ${pfx}-hub-node` : "";
      return `<g class="pele-node${classes}${hubClass}" data-id="${nodeId}" transform="translate(${tx},${ty})">${upgradedBody}</g>`;
    }
  );

  // 2. Upgrade edges: color-match, add animated dashed flow and <animateMotion> packets
  // Works for flowchart (`pele-edge`), sequence (`pele-edge pele-message`), and state (`pele-edge pele-transition`)
  const packets: string[] = [];
  const edgeRegex =
    /<g class="(pele-edge[^"]*)" data-id="([^"]+)">\s*<path d="([^"]+)"([^>]*)\/>([\s\S]*?)<\/g>/g;

  // Count edges upfront so sequence diagrams can schedule a chronological relay cycle
  const totalEdges = [...inner.matchAll(edgeRegex)].length;
  const isSequence = diagramType === "sequence";
  const isState = diagramType === "state";
  const sortedNodes = [...nodeColor.entries()].sort((a, b) => b[0].length - a[0].length);
  let edgeIndex = 0;

  inner = inner.replace(
    edgeRegex,
    (_full, edgeClass: string, edgeId: string, d: string, pathAttrs: string, rest: string) => {
      const idx = edgeIndex++;
      const pathId = `${pfx}-edge-${idx}`;

      let color = DEFAULT_ACCENT;
      if (isSequence || isState) {
        color = CYCLE_ACCENTS[idx % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;
      } else {
        const stripped = edgeId.replace(/^L_/, "").replace(/_\d+$/, "");
        for (const [nid, ncolor] of sortedNodes) {
          if (nodeIsHub.has(nid)) continue;
          if (stripped.startsWith(`${nid}_`) || stripped.endsWith(`_${nid}`)) {
            color = ncolor;
            break;
          }
        }
      }

      const styledRest = rest.replace(/fill="var\(--_l\)"/g, `fill="${color}" fill-opacity="0.88"`);
      const preserveDash = pathAttrs.includes("stroke-dasharray") ? ' stroke-dasharray="5 5"' : "";

      if (animate) {
        if (isSequence && totalEdges > 0) {
          // Chronological relay: message 0 fires, then message 1, then message 2, ...
          const stepDur = 1.15;
          const cycleDur = totalEdges * stepDur;
          const t0 = idx / totalEdges;
          const t1 = (idx + 0.88) / totalEdges;
          const fadeIn = Math.min(t0 + 0.02, t1);
          const fadeOut = Math.min(t1 + 0.04, 1);
          // Negative begin so message 0 is already mid-flight at t = 0
          const begin = -(stepDur * 0.35);

          const ktMotion =
            t0 === 0
              ? `0;${t1.toFixed(4)};1`
              : `0;${t0.toFixed(4)};${t1.toFixed(4)};1`;
          const kpMotion = t0 === 0 ? "0;1;1" : "0;0;1;1";

          const ktOpacity =
            t0 === 0
              ? `0;${fadeIn.toFixed(4)};${t1.toFixed(4)};${fadeOut.toFixed(4)};1`
              : `0;${t0.toFixed(4)};${fadeIn.toFixed(4)};${t1.toFixed(4)};${fadeOut.toFixed(4)};1`;
          const valOpacity = t0 === 0 ? "1;1;1;0;0" : "0;0;1;1;0;0";

          packets.push(
            `<circle r="4" fill="${color}">` +
              `<animateMotion dur="${cycleDur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" keyPoints="${kpMotion}" keyTimes="${ktMotion}"><mpath href="#${pathId}"/></animateMotion>` +
              `<animate attributeName="opacity" dur="${cycleDur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" keyTimes="${ktOpacity}" values="${valOpacity}"/>` +
              `</circle>`
          );
        } else {
          const dur = (2.1 + (idx % 4) * 0.22).toFixed(2);
          const begin = (-((idx * 0.43) % 2.0 + 0.2)).toFixed(2);
          packets.push(
            `<circle r="3.8" fill="${color}"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`
          );
        }
      }

      const flowLayer =
        animate && !isSequence
          ? `<path d="${d}" stroke="${color}" stroke-width="2.1" fill="none" class="${pfx}-flow"/>`
          : "";
      const baseOpacity = isSequence ? 0.8 : palette.wireBaseOpacity;

      return [
        `<g class="${edgeClass}" data-id="${edgeId}">`,
        `<path id="${pathId}" d="${d}" stroke="${color}" stroke-width="2" stroke-opacity="${baseOpacity}"${preserveDash} fill="none"/>`,
        flowLayer,
        styledRest,
        `</g>`,
      ].join("");
    }
  );

  // 3. Wrap into final padded canvas with theme styles
  // Ensure narrow vertical diagrams expand cleanly to fit title/footer text
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
        `<rect x="${Math.round(totalW / 2 - footerPillWidth / 2)}" y="${totalH - 52}" width="${Math.round(footerPillWidth)}" height="30" rx="15" fill="${palette.cardFill}" stroke="${palette.cardStroke}" stroke-width="1.2"/>`,
        `<text x="${totalW / 2}" y="${totalH - 33}" text-anchor="middle" class="${pfx}-footer">${escapeXml(options.footer)}</text>`,
      ].join("\n  ")
    : "";

  const animationCss = animate
    ? `
      .${pfx}-flow { stroke-dasharray: 6 14; stroke-linecap: round; animation: ${pfx}-dash 1.8s linear infinite; }
      .${pfx}-pulse { transform-box: fill-box; transform-origin: center; animation: ${pfx}-ring 3.2s ease-in-out infinite; }
      @keyframes ${pfx}-dash { to { stroke-dashoffset: -40; } }
      @keyframes ${pfx}-ring {
        0%, 100% { opacity: 0.25; transform: scale(0.97); }
        50% { opacity: 0.65; transform: scale(1.03); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${pfx}-flow, .${pfx}-pulse { animation: none; }
      }`
    : "";

  const packetsGroup =
    animate && packets.length > 0
      ? `<g class="${pfx}-packets">${packets.join("")}</g>`
      : "";

  // Place packets right after pele-edges (so they pass underneath edge labels and nodes)
  let innerWithPackets = inner;
  if (packetsGroup) {
    if (inner.includes('<g class="pele-edge-labels"')) {
      innerWithPackets = inner.replace(
        '<g class="pele-edge-labels"',
        `${packetsGroup}<g class="pele-edge-labels"`
      );
    } else if (inner.includes('<g class="pele-nodes"')) {
      innerWithPackets = inner.replace(
        '<g class="pele-nodes"',
        `${packetsGroup}<g class="pele-nodes"`
      );
    } else {
      innerWithPackets = `${inner}\n    ${packetsGroup}`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <style>
      .${pfx}-bg { fill: ${palette.bg}; }
      .${pfx}-title { font: 700 13px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 2px; fill: ${palette.titleColor}; text-transform: uppercase; }
      .${pfx}-footer { font: 500 12px ui-monospace, SFMono-Regular, Menlo, monospace; fill: ${palette.textMuted}; }
      .${pfx}-stage { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; fill: ${palette.textPrimary}; }
      .pele-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; fill: ${palette.textPrimary}; }
      .pele-label tspan:first-child { font-size: 14.5px; font-weight: 700; fill: ${palette.textPrimary}; }
      .pele-label tspan:nth-child(n+2) { font-size: 11.5px; font-weight: 400; fill: ${palette.textMuted}; }
      .pele-cluster-label { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; fill: ${palette.textMuted}; }
      .pele-edge-label rect { fill: ${palette.cardFill}; stroke: ${palette.cardStroke}; stroke-width: 1; rx: 6; }
      .pele-edge-label text { font-size: 12px; font-weight: 600; fill: ${palette.textPrimary}; }
      .${pfx}-hub-node .pele-label tspan:first-child { font-size: 16px; font-weight: 700; fill: ${palette.textPrimary}; }
      .${pfx}-hub-node .pele-label tspan:nth-child(2) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; fill: ${palette.titleColor}; }${animationCss}
    </style>
    <pattern id="${pfx}-dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1" fill="${palette.dotColor}"/>
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
      <stop offset="0%" stop-color="${palette.hubBgStart}"/>
      <stop offset="100%" stop-color="${palette.hubBgEnd}"/>
    </linearGradient>
  </defs>

  <rect width="${totalW}" height="${totalH}" rx="18" class="${pfx}-bg"/>
  <rect width="${totalW}" height="${totalH}" rx="18" fill="url(#${pfx}-dots)"/>
  <circle cx="${Math.round(totalW * 0.26)}" cy="${Math.round(totalH * 0.36)}" r="${Math.round(totalW * 0.28)}" fill="url(#${pfx}-glow-l)"/>
  <circle cx="${Math.round(totalW * 0.74)}" cy="${Math.round(totalH * 0.64)}" r="${Math.round(totalW * 0.28)}" fill="url(#${pfx}-glow-r)"/>

  ${titleEl}

  <g class="${pfx}-stage" transform="translate(${offsetX},${padTop})" style="--_bg:${palette.bg};--_fg:${palette.textPrimary};--_m:${palette.textMuted};--_l:${DEFAULT_ACCENT};--_s:${palette.cardFill};--_a:${palette.hubBgStart};--_b:${palette.cardStroke};--_c:${DEFAULT_ACCENT};--_r:12px">
    ${innerWithPackets}
  </g>

  ${footerEl}
</svg>
`;
}

function sanitizeIdPrefix(prefix: string): string {
  const cleaned = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || "mmd";
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
