import { ACCENT_PALETTE } from "./themes.js";

/**
 * Framed look for containers: flowchart subgraphs and block-beta blocks with an
 * accent class (`class backend emerald`) become panels in that color, and
 * timeline periods become cards.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Panel {
  id: string;
  color: string;
  box: Box;
}

export interface Panels {
  inner: string;
  /** Accent of each accented container, by id (edges leaving it take it). */
  clusterColor: Map<string, string>;
  /** The accent a node inherits from the innermost accented container around it. */
  colorAt: (x: number, y: number) => string | undefined;
}

const CLUSTER_RE =
  /<g class="pele-cluster([^"]*)" data-id="([^"]+)">\s*<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"[^>]*\/>(?:\s*<text class="pele-cluster-label"[^>]*>([\s\S]*?)<\/text>)?/g;
/** Titles pele lifts above the edges (with a halo) when an edge passes them. */
const TITLE_RE = /<g class="pele-cluster-title" data-id="([^"]+)">([\s\S]*?)<\/g>/g;

/** Accented containers become panels: tinted frame, header top left in the accent. */
export function accentPanels(source: string, pfx: string): Panels {
  const panels: Panel[] = [];
  for (const m of source.matchAll(CLUSTER_RE)) {
    const accent = (m[1] ?? "").trim().split(/\s+/).find((c) => c in ACCENT_PALETTE && c !== "hub");
    if (!accent) continue;
    const box = { x: num(m[3]), y: num(m[4]), w: num(m[5]), h: num(m[6]) };
    panels.push({ id: m[2] ?? "", color: ACCENT_PALETTE[accent] ?? "", box });
  }
  // Smallest first: the innermost container decides
  panels.sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h);
  const colorAt = (x: number, y: number) =>
    panels.find(({ box }) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h)
      ?.color;
  // An accented container passes its accent on to containers inside it that have none
  const inherit = new Map<string, string>();
  for (const m of source.matchAll(CLUSTER_RE)) {
    const id = m[2] ?? "";
    if (panels.some((p) => p.id === id)) continue;
    const color = colorAt(num(m[3]) + 1, num(m[4]) + 1);
    if (color) inherit.set(id, color);
  }

  const clusterColor = new Map<string, string>(panels.map((p) => [p.id, p.color]));
  for (const [id, color] of inherit) clusterColor.set(id, color);
  if (clusterColor.size === 0) return { inner: source, clusterColor, colorAt };

  const origin = new Map<string, { x: number; y: number }>();
  const labelAt = (x: number, y: number, color: string, label: string, halo = false) =>
    halo
      ? `<text class="pele-cluster-label ${pfx}-panel-label" x="${fmt(x + 14)}" y="${fmt(y + 24)}" text-anchor="start" style="fill:none;stroke:var(--mv-card)" stroke-width="5" stroke-linejoin="round">${label}</text>`
      : `<text class="pele-cluster-label ${pfx}-panel-label" x="${fmt(x + 14)}" y="${fmt(y + 24)}" text-anchor="start" style="fill:color-mix(in srgb,${color} 75%,var(--mv-fg))">${label}</text>`;
  let inner = source.replace(
    CLUSTER_RE,
    (full, classes: string, id: string, xs: string, ys: string, ws: string, hs: string, label?: string) => {
      const color = clusterColor.get(id);
      if (!color) return full;
      const [x, y, w, h] = [num(xs), num(ys), num(ws), num(hs)];
      origin.set(id, { x, y });
      return [
        `<g class="pele-cluster${classes} ${pfx}-panel" data-id="${id}" style="--${pfx}-accent:${color}">`,
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" class="${pfx}-panel-frame"/>`,
        `<rect x="${fmt(x + 14)}" y="${fmt(y - 1)}" width="24" height="3" rx="1.5" fill="${color}"/>`,
        label === undefined ? "" : labelAt(x, y, color, label),
      ].join("");
    }
  );
  inner = inner.replace(TITLE_RE, (full, id: string, body: string) => {
    const color = clusterColor.get(id);
    const at = origin.get(id);
    const label = /<text class="pele-cluster-label"[^>]*>([\s\S]*?)<\/text>/.exec(body)?.[1];
    if (!color || !at || label === undefined) return full;
    const halo = body.includes('fill="none"') ? labelAt(at.x, at.y, color, label, true) : "";
    return `<g class="pele-cluster-title" data-id="${id}">${halo}${labelAt(at.x, at.y, color, label)}</g>`;
  });
  return { inner, clusterColor, colorAt };
}

/**
 * A node inside a panel as a chip: tinted in the panel's accent, a dot before a
 * left-aligned label (centered, without the dot, where it leaves no room).
 * Returns null where the label has several lines.
 * `detached` nodes (no edge ends on them) may also shrink to chip height.
 */
export function chipBody(body: string, color: string, detached: boolean): string | null {
  const rect = /<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"[^>]*\/>/.exec(body);
  const text = /<text class="pele-label"([^>]*)>([^<]*)<\/text>/.exec(body);
  if (!rect || !text) return null;
  const [rx, ry, rw, rh] = [num(rect[1]), num(rect[2]), num(rect[3]), num(rect[4])];
  const label = text[2] ?? "";
  // A label's width, roughly (13px, average glyph ~0.56em), and the dot before it
  const roomy = rw >= label.length * 7.3 + 38;
  const ch = detached ? Math.min(rh, 32) : rh;
  const cy = ry + rh / 2;
  const dot = roomy ? `<circle cx="${fmt(rx + 14)}" cy="${fmt(cy)}" r="3.5" fill="${color}"/>` : "";
  const chip = `<rect x="${rx}" y="${fmt(cy - ch / 2)}" width="${rw}" height="${fmt(ch)}" rx="8" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-opacity="0.42" stroke-width="1"/>${dot}`;
  const textEl = roomy
    ? `<text class="pele-label mv-chip-label" x="${fmt(rx + 26)}" y="${fmt(cy + 4.5)}" text-anchor="start">${label}</text>`
    : `<text class="pele-label mv-chip-label" x="${fmt(rx + rw / 2)}" y="${fmt(cy + 4.5)}" text-anchor="middle">${label}</text>`;
  return body.replace(rect[0], chip).replace(text[0], textEl);
}

/**
 * Timeline periods as cards: the events of a period share one card in the
 * period's color and read as a list (a dot per event, left-aligned), instead
 * of a box per event.
 */
export function timelineCards(source: string, pfx: string): string {
  return source.replace(
    /<g class="pele-node pele-period"([^>]*)>((?:\s*(?:<rect[^>]*\/>|<text[\s\S]*?<\/text>|<path[^>]*\/>|<circle[^>]*\/>|<g class="pele-node pele-event">[\s\S]*?<\/text>\s*<\/g>))*)\s*<\/g>/g,
    (full, attrs: string, body: string) => {
      const events = [
        ...body.matchAll(
          /<g class="pele-node pele-event"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)"[^>]*\/>(<text[\s\S]*?<\/text>)<\/g>/g
        ),
      ];
      const first = events[0];
      const last = events.at(-1);
      if (!first || !last) return full;
      const color = first[5] ?? "";
      const x = num(first[1]);
      const w = num(first[3]);
      const top = num(first[2]);
      const bottom = num(last[2]) + num(last[4]);
      // The period's pill keeps its fill; under a section it is outlined in the same color (CSS)
      let out = body.replace(/^(\s*<rect [^>]*?)\/>/, `$1 stroke="${color}"/>`);
      // The stem from the axis reaches the card; the links between events go
      out = out.replace(/(<path class="pele-edge" d="M[^M"]+)[^"]*"/, '$1"');
      const card = `<rect x="${x}" y="${top}" width="${w}" height="${fmt(bottom - top)}" rx="12" class="${pfx}-period-card" style="stroke:${color}"/><rect x="${fmt(x + 14)}" y="${fmt(top - 1)}" width="24" height="3" rx="1.5" fill="${color}"/>`;
      for (const [i, event] of events.entries()) {
        const ex = num(event[1]);
        const ey = num(event[2]);
        const textEl = (event[6] ?? "")
          .replace('text-anchor="middle"', 'text-anchor="start"')
          .replace(/ x="[^"]+"/g, ` x="${fmt(ex + 21)}"`);
        const firstLine = /y="([^"]+)"/.exec(textEl);
        const dotY = firstLine ? num(firstLine[1]) - 4.5 : ey + num(event[4]) / 2;
        const lead = i === 0 ? card : "";
        out = out.replace(
          event[0],
          `${lead}<g class="pele-node pele-event"><circle cx="${fmt(ex + 11)}" cy="${fmt(dotY)}" r="3" fill="${color}"/>${textEl}</g>`
        );
      }
      return `<g class="pele-node pele-period"${attrs}>${out}</g>`;
    }
  );
}

export function panelCss(pfx: string): string {
  return `
      .${pfx}-panel-frame { fill: var(--mv-card); fill-opacity: 0.72; stroke: var(--${pfx}-accent); stroke-opacity: 0.38; stroke-width: 1.2; }
      .pele-cluster-label.${pfx}-panel-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .pele-label.mv-chip-label { font-size: 13px; font-weight: 500; fill: var(--mv-fg); }
      .${pfx}-period-card { fill: var(--mv-card); stroke-opacity: 0.4; stroke-width: 1.2; }
      .pele-event text { font-size: 13px; fill: var(--mv-fg); }
      .pele-section .pele-period > rect { fill: var(--mv-card); stroke-width: 1.4; }
      .pele-section .pele-period > text { font-weight: 600; fill: var(--mv-fg); }`;
}

function num(value: string | undefined): number {
  return Number.parseFloat(value ?? "0");
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}
