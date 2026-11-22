import type { DiagramModel } from "pele";
import { render } from "pele/core";
import "./diagrams.js";
import { ACCENT_PALETTE, THEMES, type AnimateOptions, type ThemePalette } from "./themes.js";

const DEFAULT_ACCENT = "#38BDF8";
const CYCLE_ACCENTS = ["#38BDF8", "#818CF8", "#FBBF24", "#34D399", "#F472B6"] as const;

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

  const isSequence = diagramType === "sequence";
  const isState = diagramType === "state";
  const isGitGraph = diagramType === "gitGraph";
  const isArchitecture = diagramType === "architecture";
  const isAgentflow = diagramType === "agentflow";
  const isC4 = diagramType === "c4";
  const isSwimlane = diagramType === "swimlane";
  const isSankey = diagramType === "sankey";
  const isGantt = diagramType === "gantt";
  const isTimeline = diagramType === "timeline";
  const isMindmap = diagramType === "mindmap";

  // 1. Inspect and upgrade flowchart/state nodes
  const nodeColor = new Map<string, string>();
  const nodeIsHub = new Set<string>();
  const nodeRegex =
    /<g class="pele-node([^"]*)" data-id="([^"]+)" transform="translate\(([^,]+),([^)]+)\)">([\s\S]*?)<\/g>/g;

  // Mind map nodes keep pele's shapes (pills colored by branch)
  if (!isMindmap) inner = inner.replace(
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
          const cardRect = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="12" class="${pfx}-card"/>`;
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

  // 2. Upgrade edges & build animated packets
  const packets: string[] = [];
  const extraDefs: string[] = [];

  if (isMindmap) {
    if (animate) {
      // Grow once from the root: each node fades in after its parent, and the edge
      // leading to it draws itself first. Edges and non-root nodes come in the same
      // (depth-first) order, so the n-th edge leads to the n-th node.
      const depths: number[] = [];
      inner = inner.replace(
        /<g class="pele-node([^"]*)" data-id="([^"]*)"/g,
        (full, classes: string, nodeId: string) => {
          if (classes.includes("pele-root")) return full;
          const depth = mindmapDepth(nodeId);
          depths.push(depth);
          const delay = mindmapDelay(depth, speed);
          return `<g class="pele-node${classes} ${pfx}-grow" data-id="${nodeId}" style="animation-delay:${delay}s"`;
        }
      );
      let edgeIndex = 0;
      inner = inner.replace(/<path class="pele-edge" d="/g, () => {
        const depth = depths[edgeIndex++] ?? 1;
        const delay = mindmapDelay(depth - 0.6, speed);
        return `<path class="pele-edge ${pfx}-draw" pathLength="1" style="animation-delay:${delay}s" d="`;
      });
    }
  } else if (isSankey) {
    // Compute exact centerline Bezier for each Sankey flow ribbon and stream particles through it
    let linkIdx = 0;
    const sankeyRegex =
      /<path class="pele-sankey-link" data-id="([^"]+)" d="M([^,]+),([^C]+)C([^,]+),([^ ]+) ([^,]+),([^ ]+) ([^,]+),([^L]+)L([^,]+),([^C]+)C([^,]+),([^ ]+) ([^,]+),([^ ]+) ([^,]+),([^Z]+)Z" fill="([^"]+)"/g;

    inner = inner.replace(
      sankeyRegex,
      (
        full,
        _id: string,
        x0s: string,
        y0ts: string,
        cx1s: string,
        _cy1ts: string,
        cx2s: string,
        _cy2ts: string,
        x1s: string,
        y1ts: string,
        _x1bs: string,
        y1bs: string,
        _cx2bs: string,
        _cy2bs: string,
        _cx1bs: string,
        _cy1bs: string,
        _x0bs: string,
        y0bs: string,
        fillVal: string
      ) => {
        const idx = linkIdx++;
        const x0 = Number.parseFloat(x0s);
        const y0 = (Number.parseFloat(y0ts) + Number.parseFloat(y0bs)) / 2;
        const cx1 = Number.parseFloat(cx1s);
        const cx2 = Number.parseFloat(cx2s);
        const x1 = Number.parseFloat(x1s);
        const y1 = (Number.parseFloat(y1ts) + Number.parseFloat(y1bs)) / 2;
        const seriesMatch = fillVal.match(/--pele-series-(\d+)/);
        const seriesNum =
          seriesMatch && seriesMatch[1] ? Number.parseInt(seriesMatch[1], 10) - 1 : idx;
        const color = CYCLE_ACCENTS[seriesNum % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;

        if (animate) {
          const pathId = `${pfx}-sankey-${idx}`;
          const centerD = `M${x0.toFixed(1)},${y0.toFixed(1)}C${cx1.toFixed(1)},${y0.toFixed(1)} ${cx2.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
          extraDefs.push(`<path id="${pathId}" d="${centerD}"/>`);
          const dur = (2.6 + (idx % 3) * 0.35) / speed;
          const b1 = -(((idx * 0.45) % 2.2 + 0.2) / speed);
          const b2 = b1 - dur / 2;
          packets.push(
            `<circle r="3.6" fill="${color}" fill-opacity="0.92"><animateMotion dur="${dur.toFixed(2)}s" begin="${b1.toFixed(2)}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`,
            `<circle r="2.8" fill="${color}" fill-opacity="0.65"><animateMotion dur="${dur.toFixed(2)}s" begin="${b2.toFixed(2)}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`
          );
        }
        return full;
      }
    );
  } else if (isGantt) {
    // Color each task bar with cycling series accents & add a sweeping playhead across the grid
    let taskIdx = 0;
    inner = inner.replace(
      /<g class="pele-task" data-id="([^"]+)"><rect ([^>]*?)fill="var\(--_c\)" stroke="var\(--_c\)"/g,
      (_full, tid: string, rectAttrs: string) => {
        const color = CYCLE_ACCENTS[taskIdx++ % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;
        return `<g class="pele-task" data-id="${tid}"><rect ${rectAttrs}fill="${color}" stroke="${color}"`;
      }
    );

    if (animate) {
      const axisMatch = inner.match(/<path d="M([0-9.]+),([0-9.]+)H([0-9.]+)" stroke="var\(--_b\)"\/>/);
      const gridTopMatch = inner.match(/<path d="M[0-9.]+,([0-9.]+)V([0-9.]+)/);
      if (axisMatch?.[1] && axisMatch[3] && gridTopMatch?.[1] && gridTopMatch[2]) {
        const xStart = Number.parseFloat(axisMatch[1]);
        const xEnd = Number.parseFloat(axisMatch[3]);
        const yTop = Number.parseFloat(gridTopMatch[1]);
        const yBot = Number.parseFloat(gridTopMatch[2]);
        const sweepDur = (5.5 / speed).toFixed(2);
        const begin = (-1.6 / speed).toFixed(2);
        const span = (xEnd - xStart).toFixed(1);
        packets.push(
          `<g class="${pfx}-playhead">` +
            `<line x1="${xStart}" y1="${yTop - 4}" x2="${xStart}" y2="${yBot + 2}" stroke="${DEFAULT_ACCENT}" stroke-width="2" stroke-opacity="0.75"/>` +
            `<circle cx="${xStart}" cy="${yTop - 4}" r="3.5" fill="${DEFAULT_ACCENT}"/>` +
            `<animateTransform attributeName="transform" type="translate" from="0 0" to="${span} 0" dur="${sweepDur}s" begin="${begin}s" repeatCount="indefinite"/>` +
            `</g>`
        );
      }
    }
  } else if (isTimeline) {
    // Stream a glowing packet along the timeline axis & pulse milestone dots
    const axisMatch = inner.match(/<path class="pele-axis" d="([^"]+)"([^>]*)\/>/);
    if (axisMatch?.[1]) {
      const axisId = `${pfx}-axis`;
      const d = axisMatch[1];
      const flowLayer = animate
        ? `<path d="${d}" stroke="${DEFAULT_ACCENT}" stroke-width="2.2" fill="none" class="${pfx}-flow"/>`
        : "";
      inner = inner.replace(
        axisMatch[0],
        `<path id="${axisId}" class="pele-axis" d="${d}" stroke="${DEFAULT_ACCENT}" stroke-opacity="0.4" stroke-width="2" fill="none"/>${flowLayer}`
      );
      if (animate) {
        const dur = (3.2 / speed).toFixed(2);
        const begin = (-0.9 / speed).toFixed(2);
        packets.push(
          `<circle r="4.2" fill="${DEFAULT_ACCENT}"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite"><mpath href="#${axisId}"/></animateMotion></circle>`
        );
      }
    }
    if (animate) {
      let dotIdx = 0;
      inner = inner.replace(
        /<circle class="pele-dot" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"([^>]*)\/>/g,
        (full, cx: string, cy: string, r: string) => {
          const color = CYCLE_ACCENTS[dotIdx % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;
          const haloR = (Number.parseFloat(r) + 4.5).toFixed(1);
          const delay = ((dotIdx++ * 0.45) / speed).toFixed(2);
          return `${full}<circle cx="${cx}" cy="${cy}" r="${haloR}" fill="none" stroke="${color}" stroke-width="1.4" class="${pfx}-pulse" style="animation-delay:-${delay}s"/>`;
        }
      );
    }
  } else if (isGitGraph) {
    // Pele gitGraph emits <path class="pele-edge..." d="..." stroke="var(--pele-series-N,...)"/>
    let gitEdgeIdx = 0;
    const gitEdgeRegex = /<path class="(pele-edge[^"]*)" d="([^"]+)" stroke="([^"]+)"\/>/g;
    inner = inner.replace(
      gitEdgeRegex,
      (_full, cls: string, d: string, strokeVal: string) => {
        const idx = gitEdgeIdx++;
        const pathId = `${pfx}-edge-${idx}`;
        const seriesMatch = strokeVal.match(/--pele-series-(\d+)/);
        const seriesNum = seriesMatch && seriesMatch[1] ? Number.parseInt(seriesMatch[1], 10) - 1 : idx;
        const color = CYCLE_ACCENTS[seriesNum % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;

        if (animate) {
          const dur = (2.4 + (idx % 3) * 0.35) / speed;
          const begin = -(((idx * 0.55) % 2.0 + 0.2) / speed);
          packets.push(
            `<circle r="3.4" fill="${color}"><animateMotion dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`
          );
        }

        const flowLayer = animate
          ? `<path d="${d}" stroke="${color}" stroke-width="2.2" fill="none" class="${pfx}-flow"/>`
          : "";

        return `<path id="${pathId}" class="${cls}" d="${d}" stroke="${color}" stroke-opacity="0.45" stroke-width="2.2" fill="none"/>${flowLayer}`;
      }
    );

    // Add subtle pulsing halos to git commits
    if (animate) {
      let commitIdx = 0;
      inner = inner.replace(
        /<g class="(pele-commit[^"]*)" data-id="([^"]+)">\s*<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"([^>]*)\/>/g,
        (full, _cls: string, _cid: string, cx: string, cy: string, r: string, attrs: string) => {
          const idx = commitIdx++;
          const seriesMatch = attrs.match(/--pele-series-(\d+)/);
          const seriesNum =
            seriesMatch && seriesMatch[1] ? Number.parseInt(seriesMatch[1], 10) - 1 : idx;
          const color = CYCLE_ACCENTS[seriesNum % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;
          const haloR = (Number.parseFloat(r) + 4.5).toFixed(1);
          const delay = (idx * 0.35 / speed).toFixed(2);
          return `${full}<circle cx="${cx}" cy="${cy}" r="${haloR}" fill="none" stroke="${color}" stroke-width="1.3" class="${pfx}-pulse" style="animation-delay:-${delay}s"/>`;
        }
      );
    }
  } else {
    // Flowchart (`pele-edge`), sequence (`pele-edge pele-message`), state (`pele-edge pele-transition`)
    const edgeRegex =
      /<g class="(pele-edge[^"]*)" data-id="([^"]+)">\s*<path d="([^"]+)"([^>]*)\/>([\s\S]*?)<\/g>/g;

    const totalEdges = [...inner.matchAll(edgeRegex)].length;
    const sortedNodes = [...nodeColor.entries()].sort((a, b) => b[0].length - a[0].length);
    let edgeIndex = 0;

    inner = inner.replace(
      edgeRegex,
      (_full, edgeClass: string, edgeId: string, d: string, pathAttrs: string, rest: string) => {
        const idx = edgeIndex++;
        const pathId = `${pfx}-edge-${idx}`;

        let color = DEFAULT_ACCENT;
        if (isSequence || isState || isArchitecture || isC4) {
          color = CYCLE_ACCENTS[idx % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;
        } else {
          const stripped = edgeId.replace(/^L_/, "").replace(/_\d+$/, "");
          let matched = false;
          for (const [nid, ncolor] of sortedNodes) {
            if (nodeIsHub.has(nid)) continue;
            if (stripped.startsWith(`${nid}_`) || stripped.endsWith(`_${nid}`)) {
              color = ncolor;
              matched = true;
              break;
            }
          }
          if (!matched && (isAgentflow || isSwimlane)) {
            color = CYCLE_ACCENTS[idx % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;
          }
        }

        const isThick = /stroke-width="2\.5"|stroke-width="3"/.test(pathAttrs);
        const isDotted = pathAttrs.includes("stroke-dasharray");
        const styledRest = rest.replace(/fill="var\(--_l\)"/g, `fill="${color}" fill-opacity="0.88"`);
        const preserveDash = isDotted ? ' stroke-dasharray="5 5"' : "";

        if (animate) {
          if (isSequence && totalEdges > 0) {
            const stepDur = 1.15 / speed;
            const cycleDur = totalEdges * stepDur;
            const t0 = idx / totalEdges;
            const t1 = (idx + 0.88) / totalEdges;
            const fadeIn = Math.min(t0 + 0.02, t1);
            const fadeOut = Math.min(t1 + 0.04, 1);
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
            const baseDur = isThick ? 1.45 : isDotted ? 3.0 : 2.1 + (idx % 4) * 0.22;
            const dur = baseDur / speed;
            const begin = -(((idx * 0.43) % 2.0 + 0.2) / speed);
            const radius = isThick ? "4.6" : isDotted ? "3.2" : "3.8";
            packets.push(
              `<circle r="${radius}" fill="${color}"><animateMotion dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`
            );
          }
        }

        const wireWidth = isThick ? 3 : 2;
        const flowLayer =
          animate && !isSequence && !isDotted
            ? `<path d="${d}" stroke="${color}" stroke-width="${(wireWidth + 0.2).toFixed(1)}" fill="none" class="${pfx}-flow"/>`
            : "";
        const baseOpacity = isSequence ? 0.8 : isThick ? 0.55 : palette.wireBaseOpacity;

        return [
          `<g class="${edgeClass}" data-id="${edgeId}">`,
          `<path id="${pathId}" d="${d}" stroke="${color}" stroke-width="${wireWidth}" stroke-opacity="${baseOpacity}"${preserveDash} fill="none"/>`,
          flowLayer,
          styledRest,
          `</g>`,
        ].join("");
      }
    );
  }

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
  const growDur = (0.45 / speed).toFixed(2);
  const growCss =
    isMindmap && animate
      ? `
      .${pfx}-grow { opacity: 0; animation: ${pfx}-fade ${growDur}s ease-out forwards; }
      .${pfx}-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ${pfx}-stroke ${growDur}s ease-in-out forwards; }
      @keyframes ${pfx}-fade { to { opacity: 1; } }
      @keyframes ${pfx}-stroke { to { stroke-dashoffset: 0; } }
      @media (prefers-reduced-motion: reduce) {
        .${pfx}-grow, .${pfx}-draw { opacity: 1; stroke-dashoffset: 0; animation: none; }
      }`
      : "";

  const dashDur = (1.8 / speed).toFixed(2);
  const pulseDur = (3.2 / speed).toFixed(2);
  const animationCss = animate
    ? `
      .${pfx}-flow { stroke-dasharray: 6 14; stroke-linecap: round; animation: ${pfx}-dash ${dashDur}s linear infinite; }
      .${pfx}-pulse { transform-box: fill-box; transform-origin: center; animation: ${pfx}-ring ${pulseDur}s ease-in-out infinite; }
      @keyframes ${pfx}-dash { to { stroke-dashoffset: -40; } }
      @keyframes ${pfx}-ring {
        0%, 100% { opacity: 0.25; transform: scale(0.97); }
        50% { opacity: 0.65; transform: scale(1.03); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${pfx}-flow, .${pfx}-pulse { animation: none; }
      }`
    : "";

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

  const packetsGroup =
    animate && packets.length > 0
      ? `<g class="${pfx}-packets">${packets.join("")}</g>`
      : "";

  // Place packets beneath labels/nodes/commits so dots never obscure text
  let innerWithPackets = inner;
  if (packetsGroup) {
    if (inner.includes('<g class="pele-edge-labels"')) {
      innerWithPackets = inner.replace(
        '<g class="pele-edge-labels"',
        `${packetsGroup}<g class="pele-edge-labels"`
      );
    } else if (inner.includes('<g class="pele-commits"')) {
      innerWithPackets = inner.replace(
        '<g class="pele-commits"',
        `${packetsGroup}<g class="pele-commits"`
      );
    } else if (inner.includes('<g class="pele-sankey-nodes"')) {
      innerWithPackets = inner.replace(
        '<g class="pele-sankey-nodes"',
        `${packetsGroup}<g class="pele-sankey-nodes"`
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
      .pele-task .pele-label { font-size: 12px; font-weight: 700; fill: #070B14; }
      .pele-commit-label text { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; fill: var(--mv-muted); }
      .${pfx}-hub-node .pele-label tspan:first-child { font-size: 16px; font-weight: 700; fill: var(--mv-fg); }
      .${pfx}-hub-node .pele-label tspan:nth-child(2) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; fill: var(--mv-title); }${animationCss}${growCss}
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
    ${innerWithPackets}
  </g>

  ${footerEl}
</svg>
`;
}

/** Depth of a mind map node: from its outline id ("0.2.1" is 2), else 1. */
function mindmapDepth(nodeId: string): number {
  return /^0(\.\d+)+$/.test(nodeId) ? nodeId.split(".").length - 1 : 1;
}

function mindmapDelay(depth: number, speed: number): string {
  return (Math.max(0, depth) * 0.32 / speed).toFixed(2);
}

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 1;
  return Math.min(10, Math.max(0.1, speed));
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
