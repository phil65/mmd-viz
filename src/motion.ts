import {
  animateIshikawa,
  animateJourney,
  animateRailroad,
  beatCss,
  buildUp,
  type EffectContext,
  entranceCss,
} from "./effects.js";
import { ACCENT_PALETTE } from "./themes.js";

/**
 * The animation of one diagram type, applied to the inside of a pele SVG.
 * Two styles: `framed` is mmd-viz's own look (flowchart cards with accent
 * bars, recolored edges and tasks in fixed accent colors), `embed` keeps
 * pele's drawing as it is and only adds motion, in the host's colors (pele's
 * `--_c` accent and `--pele-series-N`), for SVGs shown inside an app.
 */

export const DEFAULT_ACCENT = "#38BDF8";
export const CYCLE_ACCENTS = ["#38BDF8", "#818CF8", "#FBBF24", "#34D399", "#F472B6"] as const;

export interface MotionOptions {
  /** Pele's diagram type (`RenderResult.type`). */
  type: string;
  /** Prefix for classes, keyframes and ids: unique per SVG on a page. */
  pfx: string;
  speed: number;
  animate: boolean;
  style: "framed" | "embed";
  /** Framed style: opacity of the wires under the flowing dashes. */
  wireBaseOpacity?: number;
}

export interface Motion {
  inner: string;
  /** Rules for the SVG's `<style>`. */
  css: string;
  /** Elements for `<defs>` (motion paths). */
  defs: string[];
}

/** The relay types: their edges are steps taken one after another. */
const RELAY_TYPES = new Set<string>(["sequence", "state", "agentflow", "eventmodeling"]);
/** Edges that are relations or dependencies: drawn once, never streamed. */
const STRUCTURE_TYPES = new Set<string>(["class", "er", "requirement", "wardley"]);
/** Nodes made of compartments, which the flowchart card and accent bar would cover. */
const COMPARTMENT_TYPES = new Set<string>(["class", "er", "requirement"]);
/** Compact nodes whose label the accent bar would touch. */
const BARLESS_TYPES = new Set<string>(["state"]);
/** Particles on the widest sankey ribbon; narrower ones get proportionally fewer. */
const MAX_SANKEY_PARTICLES = 6;
/** Seconds per relay step, and how far into the first step the loop starts. */
const RELAY_STEP = 1.15;
const RELAY_LEAD = 0.35;

export function applyMotion(source: string, options: MotionOptions): Motion {
  const { type: diagramType, pfx, speed, animate } = options;
  const framed = options.style === "framed";
  let inner = source;

  // Accent colors: fixed ones when framed, the host's when embedded
  const defaultAccent = framed ? DEFAULT_ACCENT : "var(--_c)";
  const accent = (index: number): string => {
    const hex = CYCLE_ACCENTS[index % CYCLE_ACCENTS.length] ?? DEFAULT_ACCENT;
    return framed ? hex : `var(--pele-series-${(index % 5) + 1},${hex})`;
  };
  const accents = CYCLE_ACCENTS.map((_hex, index) => accent(index));
  /** Pele's own series color of an element, framed: our accent for that series. */
  const seriesAccent = (paint: string, fallback: number) => {
    if (!framed) return paint;
    const series = /--pele-series-(\d+)/.exec(paint)?.[1];
    return accent(series ? Number.parseInt(series, 10) - 1 : fallback);
  };

  const isGitGraph = diagramType === "gitGraph";
  const isArchitecture = diagramType === "architecture";
  const isAgentflow = diagramType === "agentflow";
  const isC4 = diagramType === "c4";
  const isSwimlane = diagramType === "swimlane";
  const isSankey = diagramType === "sankey";
  const isGantt = diagramType === "gantt";
  const isTimeline = diagramType === "timeline";
  const isMindmap = diagramType === "mindmap";
  // Steps that happen one after another: one packet at a time, in order
  const isRelay = RELAY_TYPES.has(diagramType);
  // Relations, not traffic: drawn once, no packets
  const isStructure = STRUCTURE_TYPES.has(diagramType);

  // 1. Framed: flowchart-style nodes become cards with an accent bar (`:::cyan` …), hubs glow
  const nodeColor = new Map<string, string>();
  const nodeIsHub = new Set<string>();
  const nodeRegex =
    /<g class="pele-node([^"]*)" data-id="([^"]+)" transform="translate\(([^,]+),([^)]+)\)">([\s\S]*?)<\/g>/g;

  // Mind map nodes keep pele's shapes (pills colored by branch), and nodes with
  // compartments (class members, ER attributes, requirement fields) keep theirs
  if (framed && !isMindmap && !COMPARTMENT_TYPES.has(diagramType)) {
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
            const cardRect = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="12" class="${pfx}-card"/>`;
            const barH = Math.max(20, rh - 26);
            const barY = ry + (rh - barH) / 2;
            // States are compact, their label starts right at the edge: no bar for them
            const accentBar = BARLESS_TYPES.has(diagramType)
              ? ""
              : `<rect x="${(rx + 10).toFixed(1)}" y="${barY.toFixed(1)}" width="5" height="${barH.toFixed(1)}" rx="2.5" fill="${color}"/>`;
            upgradedBody = upgradedBody.replace(rectMatch[0], `${cardRect}${accentBar}`);
          }
        }

        const hubClass = isHub ? ` ${pfx}-hub-node` : "";
        return `<g class="pele-node${classes}${hubClass}" data-id="${nodeId}" transform="translate(${tx},${ty})">${upgradedBody}</g>`;
      }
    );
  }

  // 2. Edges & animated packets
  const packets: string[] = [];
  const defs: string[] = [];

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
    // Particles along the centerline Bézier of each ribbon, as many as it carries
    let linkIdx = 0;
    let widest = 1;
    const sankeyRegex =
      /<path class="pele-sankey-link" data-id="([^"]+)" d="M([^,]+),([^C]+)C([^,]+),([^ ]+) ([^,]+),([^ ]+) ([^,]+),([^L]+)L([^,]+),([^C]+)C([^,]+),([^ ]+) ([^,]+),([^ ]+) ([^,]+),([^Z]+)Z" fill="([^"]+)"/g;

    for (const link of inner.matchAll(sankeyRegex)) {
      widest = Math.max(
        widest,
        Math.abs(Number.parseFloat(link[17] ?? "0") - Number.parseFloat(link[3] ?? "0"))
      );
    }
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
        const color = seriesAccent(fillVal, idx);

        if (animate) {
          const pathId = `${pfx}-sankey-${idx}`;
          const centerD = `M${x0.toFixed(1)},${y0.toFixed(1)}C${cx1.toFixed(1)},${y0.toFixed(1)} ${cx2.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
          defs.push(`<path id="${pathId}" d="${centerD}"/>`);
          // As many particles as the ribbon carries: its thickness is its value
          const thickness = Math.abs(Number.parseFloat(y0bs) - Number.parseFloat(y0ts));
          const count = Math.max(1, Math.round((MAX_SANKEY_PARTICLES * thickness) / widest));
          const radius = Math.min(4, 2.4 + thickness / 60).toFixed(1);
          const dur = 3 / speed;
          const offset = ((idx * 0.37) % 1) * dur;
          for (let k = 0; k < count; k++) {
            const begin = -(offset + (k * dur) / count);
            packets.push(
              `<circle r="${radius}" fill="${color}" fill-opacity="${k % 2 ? 0.65 : 0.92}"><animateMotion dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle>`
            );
          }
        }
        return full;
      }
    );
  } else if (isGantt) {
    // Framed: color each task with cycling accents (done ones faded, critical ones
    // stay red). Both: the task in progress glows, a playhead sweeps the grid.
    let taskIdx = 0;
    inner = inner.replace(
      /<g class="pele-task([^"]*)" data-id="([^"]+)"><(rect|path) ([^>]*?)fill="([^"]+)"( fill-opacity="[^"]*")? stroke="([^"]+)"/g,
      (full, cls: string, tid: string, tag: string, attrs: string) => {
        const active = cls.includes("pele-active");
        const working = active && animate ? ` ${pfx}-working` : "";
        if (!framed) return working ? full.replace(`class="pele-task${cls}"`, `class="pele-task${cls}${working}"`) : full;
        if (cls.includes("pele-crit")) return full;
        const color = accent(taskIdx++);
        const done = cls.includes("pele-done");
        const paint = done
          ? `fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-opacity="0.55"`
          : active
            ? `fill="${color}" fill-opacity="0.25" stroke="${color}"`
            : `fill="${color}" stroke="${color}"`;
        return `<g class="pele-task${cls}${working}" data-id="${tid}"><${tag} ${attrs}${paint}`;
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
            `<line x1="${xStart}" y1="${yTop - 4}" x2="${xStart}" y2="${yBot + 2}" stroke="${defaultAccent}" stroke-width="2" stroke-opacity="0.75"/>` +
            `<circle cx="${xStart}" cy="${yTop - 4}" r="3.5" fill="${defaultAccent}"/>` +
            `<animateTransform attributeName="transform" type="translate" from="0 0" to="${span} 0" dur="${sweepDur}s" begin="${begin}s" repeatCount="indefinite"/>` +
            `</g>`
        );
      }
    }
  } else if (isTimeline) {
    // A pulse travels the axis, milestone dots pulse in turn
    const axisMatch = inner.match(/<path class="pele-axis" d="([^"]+)"([^>]*)\/>/);
    if (axisMatch?.[1]) {
      const axisId = `${pfx}-axis`;
      const d = axisMatch[1];
      const flowLayer = animate
        ? `<path d="${d}" stroke="${defaultAccent}" stroke-width="2.2" fill="none" class="${pfx}-flow"/>`
        : "";
      const axis = framed
        ? `<path id="${axisId}" class="pele-axis" d="${d}" stroke="${DEFAULT_ACCENT}" stroke-opacity="0.4" stroke-width="2" fill="none"/>`
        : `<path id="${axisId}" class="pele-axis" d="${d}"${axisMatch[2] ?? ""}/>`;
      inner = inner.replace(axisMatch[0], `${axis}${flowLayer}`);
      if (animate) {
        const dur = (3.2 / speed).toFixed(2);
        const begin = (-0.9 / speed).toFixed(2);
        packets.push(
          `<circle r="4.2" fill="${defaultAccent}"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite"><mpath href="#${axisId}"/></animateMotion></circle>`
        );
      }
    }
    if (animate) {
      let dotIdx = 0;
      inner = inner.replace(
        /<circle class="pele-dot" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"([^>]*)\/>/g,
        (full, cx: string, cy: string, r: string) => {
          const color = accent(dotIdx);
          const haloR = (Number.parseFloat(r) + 4.5).toFixed(1);
          const delay = ((dotIdx++ * 0.45) / speed).toFixed(2);
          return `${full}<circle cx="${cx}" cy="${cy}" r="${haloR}" fill="none" stroke="${color}" stroke-width="1.4" class="${pfx}-pulse" style="animation-delay:-${delay}s"/>`;
        }
      );
    }
  } else if (isGitGraph) {
    // History replays in order: one packet per edge, edge after edge
    let gitEdgeIdx = 0;
    const gitEdgeRegex = /<path class="(pele-edge[^"]*)" d="([^"]+)" stroke="([^"]+)"\/>/g;
    const gitEdges = [...inner.matchAll(gitEdgeRegex)].length;
    inner = inner.replace(gitEdgeRegex, (_full, cls: string, d: string, strokeVal: string) => {
      const idx = gitEdgeIdx++;
      const pathId = `${pfx}-edge-${idx}`;
      const color = seriesAccent(strokeVal, idx);

      if (animate) packets.push(relayPacket(pathId, idx, gitEdges, color, speed, 3.4));

      const flowLayer = animate
        ? `<path d="${d}" stroke="${color}" stroke-width="2.2" fill="none" class="${pfx}-flow"/>`
        : "";
      // The branch's series stays readable where the line is recolored (mmd-viz/interactive)
      const series = /--pele-series-\d+/.exec(strokeVal)?.[0];
      const seriesAttr = series ? ` data-series="${series}"` : "";
      const edge = framed
        ? `<path id="${pathId}" class="${cls}" d="${d}" stroke="${color}" stroke-opacity="0.45" stroke-width="2.2" fill="none"${seriesAttr}/>`
        : `<path id="${pathId}" class="${cls}" d="${d}" stroke="${strokeVal}"/>`;
      return `${edge}${flowLayer}`;
    });

    if (animate) {
      // Each commit flashes as the replay reaches it
      let commitIdx = 0;
      inner = inner.replace(
        /<g class="(pele-commit[^"]*)" data-id="([^"]+)">\s*<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"([^>]*)\/>/g,
        (full, _cls: string, _cid: string, cx: string, cy: string, r: string, attrs: string) => {
          const idx = commitIdx++;
          const color = seriesAccent(attrs, idx);
          const haloR = (Number.parseFloat(r) + 4.5).toFixed(1);
          const cycle = Math.max(gitEdges, 1) * RELAY_STEP;
          const arrival = idx === 0 ? 0 : (idx - 1 + 0.88 - RELAY_LEAD) * RELAY_STEP;
          const delay = ((arrival - 0.06 * cycle) / speed).toFixed(2);
          return `${full}<circle cx="${cx}" cy="${cy}" r="${haloR}" fill="none" stroke="${color}" stroke-width="1.6" class="${pfx}-flash" style="animation-duration:${(cycle / speed).toFixed(2)}s;animation-delay:${delay}s"/>`;
        }
      );
    }
  } else if (!isStructure) {
    // Flowchart (`pele-edge`), sequence (`pele-edge pele-message`), state (`pele-edge pele-transition`), …
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

        let color = defaultAccent;
        if (isRelay || isArchitecture || isC4) {
          color = accent(idx);
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
          if (!matched && (isAgentflow || isSwimlane)) color = accent(idx);
        }

        const isThick = /stroke-width="2\.5"|stroke-width="3"/.test(pathAttrs);
        const isDotted = pathAttrs.includes("stroke-dasharray");

        if (animate) {
          if (isRelay && totalEdges > 0) {
            packets.push(relayPacket(pathId, idx, totalEdges, color, speed, 4));
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
          animate && !isRelay && !isDotted
            ? `<path d="${d}" stroke="${color}" stroke-width="${(wireWidth + 0.2).toFixed(1)}" fill="none" class="${pfx}-flow"/>`
            : "";

        if (!framed) {
          // Pele's wire and arrowhead as drawn; the motion runs on top
          return `<g class="${edgeClass}" data-id="${edgeId}"><path id="${pathId}" d="${d}"${pathAttrs}/>${flowLayer}${rest}</g>`;
        }
        const styledRest = rest.replace(/fill="var\(--_l\)"/g, `fill="${color}" fill-opacity="0.88"`);
        const preserveDash = isDotted ? ' stroke-dasharray="5 5"' : "";
        const baseOpacity = isRelay ? 0.8 : isThick ? 0.55 : (options.wireBaseOpacity ?? 0.32);
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

  // 3. Types that aren't about flow: a one-time build-up, or a motion of their own
  const fx: EffectContext = { pfx, speed, defs };
  let entrances = false;
  let beat = false;
  if (animate) {
    if (diagramType === "journey") {
      inner = animateJourney(inner, fx, defaultAccent);
      entrances = true;
    } else if (diagramType === "railroad") {
      inner = animateRailroad(inner, fx, defaultAccent);
    } else if (diagramType === "ishikawa") {
      inner = animateIshikawa(inner, fx, accents);
      beat = true;
    } else {
      const built = buildUp(diagramType, inner, fx);
      if (built !== null) {
        inner = built;
        entrances = true;
      }
    }
  }

  // 4. Packets go beneath labels, nodes and commits, so dots never cover text
  if (animate && packets.length > 0) {
    const group = `<g class="${pfx}-packets">${packets.join("")}</g>`;
    const before = [
      '<g class="pele-edge-labels"',
      '<g class="pele-commits"',
      '<g class="pele-sankey-nodes"',
      '<g class="pele-nodes"',
    ].find((anchor) => inner.includes(anchor));
    inner = before ? inner.replace(before, `${group}${before}`) : `${inner}${group}`;
  }

  return { inner, css: animate ? motionCss(pfx, speed, { entrances, beat, mindmap: isMindmap }) : "", defs };
}

function motionCss(
  pfx: string,
  speed: number,
  { entrances, beat, mindmap }: { entrances: boolean; beat: boolean; mindmap: boolean }
): string {
  const dashDur = (1.8 / speed).toFixed(2);
  const pulseDur = (3.2 / speed).toFixed(2);
  const growDur = (0.45 / speed).toFixed(2);
  const grow = mindmap
    ? `
      .${pfx}-grow { animation: ${pfx}-fade ${growDur}s ease-out both; }
      .${pfx}-draw { stroke-dasharray: 1; animation: ${pfx}-stroke ${growDur}s ease-in-out both; }
      @keyframes ${pfx}-fade { from { opacity: 0; } }
      @keyframes ${pfx}-stroke { from { stroke-dashoffset: 1; } }
      @media (prefers-reduced-motion: reduce) { .${pfx}-grow, .${pfx}-draw { animation: none; } }`
    : "";
  return `
      .${pfx}-flow { stroke-dasharray: 6 14; stroke-linecap: round; animation: ${pfx}-dash ${dashDur}s linear infinite; }
      .${pfx}-pulse { transform-box: fill-box; transform-origin: center; animation: ${pfx}-ring ${pulseDur}s ease-in-out infinite; }
      @keyframes ${pfx}-dash { to { stroke-dashoffset: -40; } }
      @keyframes ${pfx}-ring {
        0%, 100% { opacity: 0.25; transform: scale(0.97); }
        50% { opacity: 0.65; transform: scale(1.03); }
      }
      .${pfx}-flash { opacity: 0.15; animation: ${pfx}-flash 4s linear infinite; }
      @keyframes ${pfx}-flash { 0% { opacity: 0.15; } 6% { opacity: 0.95; } 22%, 100% { opacity: 0.15; } }
      .${pfx}-working > rect { animation: ${pfx}-working ${pulseDur}s ease-in-out infinite; }
      @keyframes ${pfx}-working { 50% { fill-opacity: 0.55; } }
      @media (prefers-reduced-motion: reduce) {
        .${pfx}-flow, .${pfx}-pulse, .${pfx}-flash, .${pfx}-working > rect { animation: none; }
        /* SMIL ignores the media query: what moves by it (packets, playhead, markers) goes */
        .${pfx}-packets, .${pfx}-smil { display: none; }
      }${grow}${entrances ? entranceCss(pfx, speed) : ""}${beat ? beatCss(pfx, speed) : ""}`;
}

/** Depth of a mind map node: from its outline id ("0.2.1" is 2), else 1. */
function mindmapDepth(nodeId: string): number {
  return /^0(\.\d+)+$/.test(nodeId) ? nodeId.split(".").length - 1 : 1;
}

function mindmapDelay(depth: number, speed: number): string {
  return ((Math.max(0, depth) * 0.32) / speed).toFixed(2);
}

/**
 * The `index`-th of `total` steps: a packet that travels its path while the
 * others wait, so the loop replays the steps in order.
 */
function relayPacket(
  pathId: string,
  index: number,
  total: number,
  color: string,
  speed: number,
  radius: number
): string {
  const stepDur = RELAY_STEP / speed;
  const cycleDur = total * stepDur;
  const t0 = index / total;
  const t1 = (index + 0.88) / total;
  const fadeIn = Math.min(t0 + 0.02, t1);
  const fadeOut = Math.min(t1 + 0.04, 1);
  const begin = -(stepDur * RELAY_LEAD);
  const ktMotion = t0 === 0 ? `0;${t1.toFixed(4)};1` : `0;${t0.toFixed(4)};${t1.toFixed(4)};1`;
  const kpMotion = t0 === 0 ? "0;1;1" : "0;0;1;1";
  const ktOpacity =
    t0 === 0
      ? `0;${fadeIn.toFixed(4)};${t1.toFixed(4)};${fadeOut.toFixed(4)};1`
      : `0;${t0.toFixed(4)};${fadeIn.toFixed(4)};${t1.toFixed(4)};${fadeOut.toFixed(4)};1`;
  const valOpacity = t0 === 0 ? "1;1;1;0;0" : "0;0;1;1;0;0";
  return (
    `<circle r="${radius}" fill="${color}">` +
    `<animateMotion dur="${cycleDur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" keyPoints="${kpMotion}" keyTimes="${ktMotion}"><mpath href="#${pathId}"/></animateMotion>` +
    `<animate attributeName="opacity" dur="${cycleDur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" keyTimes="${ktOpacity}" values="${valOpacity}"/>` +
    `</circle>`
  );
}

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 1;
  return Math.min(10, Math.max(0.1, speed));
}

export function sanitizeIdPrefix(prefix: string): string {
  const cleaned = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || "mmd";
}
