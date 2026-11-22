/**
 * Interaction for a diagram pele drew, in a page (browser only, opt-in: the
 * SVGs mmd-viz writes stay zero-JS). It works on any pele SVG, framed by
 * renderAnimatedSvg, animated by animateSvg or plain:
 *
 * - hover a node: it, its edges and its neighbors stay, the rest fades
 * - sankey: hover a node or ribbon to see the flows through it
 * - gitGraph: hover a branch, commit or line to see that branch
 * - sequence and state diagrams: step through messages or transitions
 *
 * Nothing is drawn again: it only sets classes on pele's elements, and a
 * small stylesheet in the SVG fades what's out of focus.
 */

export interface InteractiveOptions {
  /** Pele's diagram type; read from the SVG's `pele-<type>` class when left out. */
  type?: string;
  /** Highlight on hover (default `true`). */
  hover?: boolean;
  /** Called when the step or the highlight changes. */
  onChange?: (state: InteractiveState) => void;
}

export interface InteractiveState {
  /** Steps of a sequence or state diagram (`0`: the type has none). */
  steps: number;
  /** The current step, or `-1` when not stepping (everything shown). */
  step: number;
  /** What's highlighted: a node's or ribbon's id, or `null`. */
  focus: string | null;
}

export interface Interactive extends InteractiveState {
  /** Go to a step (clamped); `-1` leaves stepping. */
  setStep(step: number): void;
  /** The next step (starts stepping at the first). */
  next(): void;
  /** The step before (leaves stepping before the first). */
  prev(): void;
  /** Leave stepping and drop the highlight. */
  reset(): void;
  /** Highlight a node (or sankey node or ribbon, git branch) by id; `null` drops it. */
  focusOn(id: string | null): void;
  /** Remove the listeners, classes and stylesheet. */
  destroy(): void;
}

/** Types whose edges are steps in order. */
const STEPPED = new Set(["sequence", "state"]);

const ON = "mmdi-on";
const FOCUS = "mmdi-focus";
const STEPPING = "mmdi-stepping";
const PAST = "mmdi-past";
const NOW = "mmdi-now";
/** A state diagram: stepping also shows which state it's in. */
const STATES = "mmdi-states";

const STYLE = `
  .${FOCUS} .pele-node:not(.${ON}), .${FOCUS} .pele-edge:not(.${ON}), .${FOCUS} .pele-edge-label:not(.${ON}),
  .${FOCUS} .pele-sankey-link:not(.${ON}), .${FOCUS} .pele-sankey-node:not(.${ON}), .${FOCUS} g.pele-label:not(.${ON}),
  .${FOCUS} .pele-commit:not(.${ON}), .${FOCUS} .pele-commit-label:not(.${ON}), .${FOCUS} .pele-branch:not(.${ON}),
  .${FOCUS} [class$="-packets"], .${FOCUS} [class$="-flow"]:not(.${ON}):not(.${ON} *) { opacity: 0.18; transition: opacity 0.15s; }
  .${STEPPING} .pele-message:not(.${PAST}):not(.${NOW}), .${STEPPING} .pele-transition:not(.${PAST}):not(.${NOW}),
  .${STEPPING} .pele-edge-label:not(.${PAST}):not(.${NOW}) { opacity: 0.12; }
  .${STEPPING} .${PAST} { opacity: 0.55; }
  .${STEPPING}.${STATES} .pele-node:not(.${NOW}) { opacity: 0.4; }
  .${STEPPING} .${NOW} { opacity: 1; }
  .${STEPPING} .${NOW} path { stroke-width: 2.6; }
  .${STEPPING} .pele-node.${NOW} > :first-child { stroke-width: 2.4; }
  .${STEPPING} [class$="-packets"] { display: none; }
  .pele-node, .pele-sankey-link, .pele-sankey-node, .pele-commit, .pele-branch { cursor: default; }
`;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Distance from a point to a box (0 inside). */
export function distanceToBox(point: Point, box: Box): number {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width));
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height));
  return Math.hypot(dx, dy);
}

/** The id of the box nearest a point, within `reach`. */
export function nearestBox(point: Point, boxes: ReadonlyMap<string, Box>, reach = 24): string | null {
  let best: string | null = null;
  let bestDistance = reach;
  for (const [id, box] of boxes) {
    const distance = distanceToBox(point, box);
    if (distance < bestDistance || (distance === bestDistance && best === null)) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

/** Sankey link ids are `source->target`. */
export function sankeyEnds(linkId: string): [string, string] | null {
  const at = linkId.indexOf("->");
  return at > 0 ? [linkId.slice(0, at), linkId.slice(at + 2)] : null;
}

/** Everything a flow passes through: the links up- and downstream of a node. */
export function flowThrough(node: string, links: readonly string[]): Set<string> {
  const ends = links.map((id) => [id, sankeyEnds(id)] as const);
  const result = new Set<string>([node]);
  const walk = (from: string, forward: boolean) => {
    for (const [id, pair] of ends) {
      if (!pair) continue;
      const [source, target] = pair;
      if ((forward ? source : target) !== from || result.has(id)) continue;
      result.add(id);
      const next = forward ? target : source;
      result.add(next);
      walk(next, forward);
    }
  };
  walk(node, true);
  walk(node, false);
  return result;
}

/** The `--pele-series-N` a git element is painted with (`data-series` where it was recolored). */
function seriesOf(el: Element): string | null {
  for (const node of [el, ...el.querySelectorAll("*")]) {
    const series = node.getAttribute("data-series");
    if (series) return series;
    for (const name of ["fill", "stroke", "style"]) {
      const match = /--pele-series-\d+/.exec(node.getAttribute(name) ?? "");
      if (match) return match[0];
    }
  }
  return null;
}

/** A box in the SVG's own coordinates (through any group transforms). */
function boxIn(svg: SVGSVGElement, el: SVGGraphicsElement): Box | null {
  const toSvg = svg.getScreenCTM()?.inverse();
  const own = el.getScreenCTM();
  if (!toSvg || !own) return null;
  const matrix = toSvg.multiply(own);
  const b = el.getBBox();
  const corners = [
    new DOMPoint(b.x, b.y),
    new DOMPoint(b.x + b.width, b.y + b.height),
  ].map((p) => p.matrixTransform(matrix));
  const [a, c] = corners as [DOMPoint, DOMPoint];
  return { x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), width: Math.abs(c.x - a.x), height: Math.abs(c.y - a.y) };
}

function endsOf(svg: SVGSVGElement, path: SVGPathElement): [Point, Point] | null {
  const toSvg = svg.getScreenCTM()?.inverse();
  const own = path.getScreenCTM();
  if (!toSvg || !own) return null;
  const matrix = toSvg.multiply(own);
  const length = path.getTotalLength();
  const start = path.getPointAtLength(0);
  const end = path.getPointAtLength(length);
  return [
    new DOMPoint(start.x, start.y).matrixTransform(matrix),
    new DOMPoint(end.x, end.y).matrixTransform(matrix),
  ];
}

function middleOf(svg: SVGSVGElement, path: SVGPathElement): Point | null {
  const toSvg = svg.getScreenCTM()?.inverse();
  const own = path.getScreenCTM();
  if (!toSvg || !own) return null;
  const point = path.getPointAtLength(path.getTotalLength() / 2);
  return new DOMPoint(point.x, point.y).matrixTransform(toSvg.multiply(own));
}

/** Makes a drawn diagram interactive. */
export function interactive(svg: SVGSVGElement, options: InteractiveOptions = {}): Interactive {
  const type =
    options.type ??
    [...svg.classList].find((name) => name.startsWith("pele-"))?.slice("pele-".length) ??
    "";
  if (type === "state") svg.classList.add(STATES);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = STYLE;
  svg.prepend(style);

  // Nodes and the edges between them, from where each edge starts and ends
  const nodes = new Map<string, SVGGraphicsElement>();
  for (const el of svg.querySelectorAll<SVGGraphicsElement>("g.pele-node[data-id]")) {
    nodes.set(el.dataset.id ?? "", el);
  }
  const boxes = new Map<string, Box>();
  for (const [id, el] of nodes) {
    const box = boxIn(svg, el);
    if (box) boxes.set(id, box);
  }
  const edges = [...svg.querySelectorAll<SVGGElement>("g.pele-edge")];
  const edgePaths = edges.map((edge) => edge.querySelector<SVGPathElement>("path:not(.pele-marker)"));
  const edgeEnds = edgePaths.map((path) => {
    const ends = path ? endsOf(svg, path) : null;
    return ends
      ? ([nearestBox(ends[0], boxes), nearestBox(ends[1], boxes)] as const)
      : ([null, null] as const);
  });
  // Each label belongs to the edge whose middle is nearest (not every edge has one)
  const labels = new Map<number, SVGGElement>();
  const middles = edgePaths.map((path) => (path ? middleOf(svg, path) : null));
  for (const label of svg.querySelectorAll<SVGGElement>("g.pele-edge-label")) {
    const box = boxIn(svg, label);
    if (!box) continue;
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    middles.forEach((middle, index) => {
      if (!middle || labels.has(index)) return;
      const distance = distanceToBox(middle, box);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best >= 0) labels.set(best, label);
  }
  const labelOf = (index: number) => labels.get(index);

  const state: InteractiveState = {
    steps: STEPPED.has(type) ? edges.length : 0,
    step: -1,
    focus: null,
  };
  const changed = () => options.onChange?.({ ...state });

  const clear = (...names: string[]) => {
    for (const name of names) for (const el of svg.querySelectorAll(`.${name}`)) el.classList.remove(name);
  };
  const mark = (els: Iterable<Element | undefined | null>, name = ON) => {
    for (const el of els) el?.classList.add(name);
  };

  const focusOn = (id: string | null) => {
    clear(ON);
    svg.classList.toggle(FOCUS, id !== null);
    state.focus = id;
    if (id === null) return changed();

    if (type === "sankey") {
      const links = [...svg.querySelectorAll<SVGElement>(".pele-sankey-link[data-id]")];
      const ids = links.map((link) => link.dataset.id ?? "");
      const ends = sankeyEnds(id);
      const on = ends ? new Set([id, ...ends]) : flowThrough(id, ids);
      for (const el of svg.querySelectorAll<SVGElement>("[data-id]")) {
        if (on.has(el.dataset.id ?? "")) el.classList.add(ON);
      }
    } else if (type === "gitGraph") {
      // A branch is everything painted in its color
      const source = svg.querySelector<SVGElement>(`[data-id="${CSS.escape(id)}"]`);
      const series = source ? seriesOf(source) : null;
      if (series) {
        for (const el of svg.querySelectorAll(".pele-branch, .pele-commit, .pele-edge")) {
          if (seriesOf(el) !== series) continue;
          el.classList.add(ON);
          // The flowing dashes drawn over a line (framed) go with it
          const next = el.nextElementSibling;
          if (next && /-flow\b/.test(next.getAttribute("class") ?? "")) next.classList.add(ON);
        }
      }
    } else {
      mark([nodes.get(id)]);
      edgeEnds.forEach(([from, to], index) => {
        if (from !== id && to !== id) return;
        mark([edges[index], labelOf(index), nodes.get(from ?? ""), nodes.get(to ?? "")]);
      });
    }
    changed();
  };

  const setStep = (step: number) => {
    clear(PAST, NOW);
    state.step = state.steps === 0 ? -1 : Math.max(-1, Math.min(step, state.steps - 1));
    svg.classList.toggle(STEPPING, state.step >= 0);
    if (state.step >= 0) {
      edges.forEach((edge, index) => {
        if (index > state.step) return;
        const name = index === state.step ? NOW : PAST;
        mark([edge, labelOf(index)], name);
      });
      // A state diagram is in the state the current transition leads to
      if (type === "state") mark([nodes.get(edgeEnds[state.step]?.[1] ?? "")], NOW);
    }
    changed();
  };

  // Hover: the nearest thing with an id under the pointer
  const hoverable =
    type === "sankey"
      ? ".pele-sankey-link[data-id], .pele-sankey-node[data-id], .pele-label[data-id]"
      : type === "gitGraph"
        ? ".pele-branch[data-id], .pele-commit[data-id]"
        : "g.pele-node[data-id]";
  const onOver = (event: Event) => {
    if (state.step >= 0) return;
    const target = (event.target as Element).closest<SVGElement>(hoverable);
    const id = target?.dataset.id ?? null;
    if (id !== state.focus) focusOn(id);
  };
  const onLeave = () => {
    if (state.focus !== null) focusOn(null);
  };
  const hover = options.hover ?? true;
  if (hover) {
    svg.addEventListener("pointerover", onOver);
    svg.addEventListener("pointerleave", onLeave);
  }

  return {
    get steps() {
      return state.steps;
    },
    get step() {
      return state.step;
    },
    get focus() {
      return state.focus;
    },
    setStep,
    next: () => setStep(state.step + 1),
    prev: () => setStep(state.step - 1),
    reset: () => {
      setStep(-1);
      focusOn(null);
    },
    focusOn,
    destroy: () => {
      svg.removeEventListener("pointerover", onOver);
      svg.removeEventListener("pointerleave", onLeave);
      clear(ON, PAST, NOW);
      svg.classList.remove(FOCUS, STEPPING, STATES);
      style.remove();
    },
  };
}
