/**
 * Zero-JS animations for the diagram types that aren't about flow: a one-time
 * build-up (`fx-*` classes with staggered delays, CSS keyframes that end where
 * the drawing already is, so without animation, or with reduced motion, the
 * SVG simply shows), plus a few looping motions that suit one type (a marker
 * walking a journey, a token along a railroad track, causes flowing into an
 * Ishikawa spine).
 */

export interface EffectContext {
  /** Prefix for classes and ids. */
  pfx: string;
  speed: number;
  /**
   * Elements for `<defs>` (motion paths). A path there is read in the user
   * space of the element moving along it, so markers sit next to what they
   * follow, inside the same (translated) group.
   */
  defs: string[];
}

/** One-time entrance kinds. */
export type Entrance =
  /** Fade in. */
  | "fade"
  /** Scale up from its own center. */
  | "pop"
  /** Scale up from the drawing's local origin (pie and radar centers). */
  | "bloom"
  /** Rise from slightly below. */
  | "rise"
  /** Grow up from its bottom edge (bars). */
  | "grow-y"
  /** Grow right from its left edge (packet fields). */
  | "grow-x"
  /** Draw its stroke from start to end (a path; gets `pathLength="1"`). */
  | "draw";

const ENTRANCES: readonly Entrance[] = ["fade", "pop", "bloom", "rise", "grow-y", "grow-x", "draw"];

/** Seconds between two staggered entrances. */
export const STEP = 0.12;

export function entranceCss(pfx: string, speed: number): string {
  const dur = (0.6 / speed).toFixed(2);
  const rules: Record<Entrance, string> = {
    fade: "from { opacity: 0; }",
    pop: "from { opacity: 0; scale: 0.6; }",
    bloom: "from { opacity: 0; scale: 0; }",
    rise: "from { opacity: 0; translate: 0 12px; }",
    "grow-y": "from { scale: 1 0; }",
    "grow-x": "from { scale: 0 1; }",
    draw: "from { stroke-dashoffset: 1; }",
  };
  const origin: Partial<Record<Entrance, string>> = {
    pop: "transform-box: fill-box; transform-origin: center;",
    bloom: "transform-box: view-box; transform-origin: 0 0;",
    "grow-y": "transform-box: fill-box; transform-origin: bottom;",
    "grow-x": "transform-box: fill-box; transform-origin: left;",
    draw: "stroke-dasharray: 1;",
  };
  return ENTRANCES.map(
    (kind) =>
      `
      .${pfx}-fx-${kind} { ${origin[kind] ?? ""} animation: ${pfx}-in-${kind} ${dur}s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
      @keyframes ${pfx}-in-${kind} { ${rules[kind]} }`
  ).join("") + `
      @media (prefers-reduced-motion: reduce) {
        ${ENTRANCES.map((kind) => `.${pfx}-fx-${kind}`).join(", ")} { animation: none; }
      }`;
}

const OPEN_TAG = /<(g|path|rect|circle|ellipse|text|line|polygon|polyline)(\s[^>]*?)?(\/?)>/g;

function classesOf(attrs: string): string[] {
  return /\sclass="([^"]*)"/.exec(attrs)?.[1]?.split(/\s+/) ?? [];
}

/** An opening tag with an entrance class and delay added. */
function withEntrance(
  tag: string,
  name: string,
  attrs: string,
  close: string,
  pfx: string,
  kind: Entrance,
  delay: number
): string {
  let next = attrs;
  const cls = `${pfx}-fx-${kind}`;
  next = /\sclass="/.test(next)
    ? next.replace(/\sclass="([^"]*)"/, ` class="$1 ${cls}"`)
    : `${next} class="${cls}"`;
  const style = `animation-delay:${delay.toFixed(2)}s`;
  next = /\sstyle="/.test(next)
    ? next.replace(/\sstyle="([^"]*)"/, (_m, s: string) => ` style="${s.replace(/;?$/, ";")}${style}"`)
    : `${next} style="${style}"`;
  if (kind === "draw" && name === "path" && !/\spathLength=/.test(next)) next += ' pathLength="1"';
  return tag.startsWith("<") ? `<${name}${next}${close}>` : tag;
}

export interface EntranceRule {
  /** Class the element carries (`pele-slice`), or a test on its tag name and classes. */
  match: string | ((name: string, classes: string[], attrs: string) => boolean);
  kind: Entrance;
  /** Delay of the n-th match, in seconds before the speed is applied. */
  delay: (index: number) => number;
}

/** Adds an entrance to every opening tag a rule matches (the first matching rule wins). */
export function stagger(inner: string, rules: EntranceRule[], ctx: EffectContext): string {
  const counts = rules.map(() => 0);
  return inner.replace(OPEN_TAG, (tag, name: string, attrs = "", close: string) => {
    const classes = classesOf(attrs);
    const at = rules.findIndex((rule) =>
      typeof rule.match === "string" ? classes.includes(rule.match) : rule.match(name, classes, attrs)
    );
    const rule = rules[at];
    if (!rule) return tag;
    const index = counts[at]!++;
    return withEntrance(tag, name, attrs, close, ctx.pfx, rule.kind, rule.delay(index) / ctx.speed);
  });
}

/** Applies `fn` to the inside of every element that opens with `opener` (balanced `<g>`s). */
export function withinGroups(
  inner: string,
  opener: RegExp,
  fn: (body: string, index: number) => string
): string {
  let out = "";
  let rest = inner;
  let index = 0;
  for (;;) {
    const match = opener.exec(rest);
    if (!match) return out + rest;
    const start = match.index + match[0].length;
    let depth = 1;
    const tags = /<(\/?)g\b[^>]*?(\/?)>/g;
    tags.lastIndex = start;
    let end = rest.length;
    for (let tag = tags.exec(rest); tag; tag = tags.exec(rest)) {
      if (tag[2]) continue;
      depth += tag[1] ? -1 : 1;
      if (depth === 0) {
        end = tag.index;
        break;
      }
    }
    out += rest.slice(0, start) + fn(rest.slice(start, end), index++);
    rest = rest.slice(end);
  }
}

/** Every element is a `<g>`, `<path>`, … tag: the step a staggered rule uses. */
export const every = (step = STEP, start = 0) => (index: number) => start + index * step;

/** Paths inside `g.pele-edges` / `g.pele-edge` groups that aren't arrowheads. */
const edgeLine = (name: string, classes: string[]) =>
  name === "path" && !classes.includes("pele-marker");

/**
 * Entities first, then their relations drawn: class, ER, requirement and
 * Wardley diagrams, whose edges are dependencies, not traffic.
 */
export function buildStructure(inner: string, ctx: EffectContext): string {
  const nodeCount = (inner.match(/<g class="pele-node\b/g) ?? []).length;
  const edgesStart = 0.3 + nodeCount * STEP;
  let out = stagger(
    inner,
    [
      { match: "pele-node", kind: "rise", delay: every() },
      { match: "pele-edge-label", kind: "fade", delay: every(STEP, edgesStart + 0.4) },
    ],
    ctx
  );
  out = withinGroups(out, /<g class="pele-edge\b[^"]*"[^>]*>/, (body, index) =>
    stagger(
      body,
      [
        { match: edgeLine, kind: "draw", delay: () => edgesStart + index * STEP },
        { match: "pele-marker", kind: "fade", delay: () => edgesStart + index * STEP + 0.4 },
      ],
      ctx
    )
  );
  return out;
}

/** Per-type one-time build-ups. Returns `null` for types without one. */
export function buildUp(type: string, inner: string, ctx: EffectContext): string | null {
  switch (type) {
    case "class":
    case "er":
    case "requirement":
    case "wardley":
      return buildStructure(inner, ctx);
    case "pie":
      return stagger(
        inner,
        [
          { match: "pele-slice", kind: "bloom", delay: every(0.16) },
          { match: "pele-legend-item", kind: "fade", delay: every(STEP, 0.3) },
          { match: (name, c) => name === "g" && c.includes("pele-slice-labels"), kind: "fade", delay: () => 0.8 },
        ],
        ctx
      );
    case "xychart": {
      let series = 0;
      return withinGroups(
        stagger(inner, [{ match: (n, c) => n === "path" && c.includes("pele-line"), kind: "draw", delay: () => 0.5 }], ctx),
        /<g class="pele-series pele-(bars|line)"[^>]*>/,
        (body) => {
          const offset = 0.15 * series++;
          return stagger(
            body,
            [
              { match: (name) => name === "rect", kind: "grow-y", delay: every(0.1, offset) },
              { match: (name) => name === "path", kind: "draw", delay: () => 0.45 + offset },
              { match: (name) => name === "circle", kind: "pop", delay: every(0.08, 0.7 + offset) },
            ],
            ctx
          );
        }
      );
    }
    case "radar":
      return stagger(
        inner,
        [
          { match: "pele-curve", kind: "bloom", delay: every(0.25) },
          { match: "pele-legend-item", kind: "fade", delay: every(STEP, 0.3) },
        ],
        ctx
      );
    case "quadrantChart":
      return stagger(
        inner,
        [
          { match: "pele-quadrant", kind: "fade", delay: every(0.08) },
          { match: "pele-point", kind: "pop", delay: every(STEP, 0.4) },
          { match: (n, c) => n === "g" && c.includes("pele-point-labels"), kind: "fade", delay: () => 0.8 },
        ],
        ctx
      );
    case "treemap":
      return stagger(
        inner,
        [
          { match: "pele-section", kind: "fade", delay: every(0.15) },
          { match: "pele-leaf", kind: "pop", delay: every(0.1, 0.2) },
        ],
        ctx
      );
    case "venn":
      return stagger(
        inner,
        [
          { match: "pele-venn-set", kind: "pop", delay: every(0.25) },
          { match: "pele-venn-region", kind: "fade", delay: every(STEP, 0.6) },
        ],
        ctx
      );
    case "kanban":
      return withinGroups(inner, /<g class="pele-cluster pele-column"[^>]*>/, (body, column) =>
        stagger(body, [{ match: "pele-card", kind: "rise", delay: every(0.1, 0.15 + column * 0.18) }], ctx)
      );
    case "packet":
      return stagger(inner, [{ match: "pele-node", kind: "grow-x", delay: every(0.14) }], ctx);
    case "treeView":
      return stagger(
        inner,
        [
          { match: "pele-node", kind: "rise", delay: every(0.09) },
          { match: "pele-tree-guides", kind: "fade", delay: () => 0.2 },
        ],
        ctx
      );
    case "cynefin":
      return stagger(
        inner,
        [
          { match: "pele-cynefin-region", kind: "fade", delay: every(0.14) },
          { match: "pele-cynefin-cliff", kind: "draw", delay: () => 0.6 },
          { match: "pele-node", kind: "rise", delay: every(0.07, 0.6) },
        ],
        ctx
      );
    case "info":
      return stagger(inner, [{ match: "pele-version", kind: "rise", delay: () => 0 }], ctx);
    default:
      return null;
  }
}

// --- Looping motions --------------------------------------------------------

const dur = (seconds: number, speed: number) => (seconds / speed).toFixed(2);

/**
 * Journey: a marker walks the satisfaction line from the first task to the
 * last, the faces show up along the way.
 */
export function animateJourney(inner: string, ctx: EffectContext, color: string): string {
  const id = `${ctx.pfx}-journey`;
  const walk = dur(6, ctx.speed);
  const lined = inner.replace(
    /<path class="pele-edge" d="([^"]+)"([^>]*)\/>/,
    (_full, d: string, attrs: string) => {
      ctx.defs.push(`<path id="${id}" d="${d}"/>`);
      const rest = attrs.replace(/\sstroke="[^"]*"/, "");
      return (
        `<path class="pele-edge" d="${d}"${rest} stroke="${color}" stroke-width="2.4"/>` +
        `<circle r="5.5" fill="${color}" stroke="#fff" stroke-opacity="0.6" stroke-width="1.5">` +
        `<animateMotion dur="${walk}s" begin="0s" repeatCount="indefinite" calcMode="linear"><mpath href="#${id}"/></animateMotion></circle>`
      );
    }
  );
  return stagger(
    lined,
    [
      { match: "pele-task", kind: "rise", delay: every(0.1) },
      { match: "pele-face", kind: "pop", delay: every(0.18, 0.5) },
      { match: (n, c) => n === "path" && c.includes("pele-edge"), kind: "draw", delay: () => 0.4 },
    ],
    ctx
  );
}

/**
 * Railroad: the grammar is read left to right, so dashes flow along every
 * track and a token travels each rule's main line from its start to its end.
 */
export function animateRailroad(inner: string, ctx: EffectContext, color: string): string {
  let rule = 0;
  return withinGroups(inner, /<g class="pele-rule"[^>]*>/, (body) => {
    const start = /<circle class="[^"]*\bpele-start\b[^"]*" cx="([^"]+)" cy="([^"]+)"/.exec(body);
    const end = /<circle class="[^"]*\bpele-end\b[^"]*" cx="([^"]+)" cy="([^"]+)"/.exec(body);
    const index = rule++;
    let next = body.replace(
      /<path class="pele-edge pele-track" d="([^"]+)"([^>]*)\/>/,
      (full, d: string) => `${full}<path d="${d}" stroke="${color}" stroke-width="2.2" fill="none" class="${ctx.pfx}-flow"/>`
    );
    if (start?.[1] && start[2] && end?.[1]) {
      const id = `${ctx.pfx}-rail-${index}`;
      ctx.defs.push(`<path id="${id}" d="M${start[1]},${start[2]}H${end[1]}"/>`);
      next += `<circle r="4.5" fill="${color}"><animateMotion dur="${dur(3.4, ctx.speed)}s" begin="${dur(-index * 0.8, ctx.speed)}s" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion></circle>`;
    }
    return next;
  });
}

/**
 * Ishikawa: every cause flows from the tip of its bone into the spine and on
 * to the effect, which pulses as they arrive.
 */
export function animateIshikawa(inner: string, ctx: EffectContext, colors: readonly string[]): string {
  const spine = /<path class="pele-ishikawa-spine" d="M([-\d.]+),([-\d.]+)H([-\d.]+)"/.exec(inner);
  if (!spine?.[2] || !spine[3]) return inner;
  const [, , spineY, headX] = spine;
  const cycle = 3.2;
  let bone = 0;
  const flowing = inner.replace(
    /<path class="pele-ishikawa-bones" d="M([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)[^"]*"[^>]*\/>/g,
    (full, jx: string, jy: string, tx: string, ty: string) => {
      const index = bone++;
      const id = `${ctx.pfx}-bone-${index}`;
      // From the cause's tip down its bone, then along the spine into the effect
      ctx.defs.push(`<path id="${id}" d="M${tx},${ty}L${jx},${jy}L${jx},${spineY}H${headX}"/>`);
      const color = colors[index % colors.length] ?? "#38BDF8";
      const begin = dur(-index * (cycle / 3.3), ctx.speed);
      return `${full}<circle r="3.8" fill="${color}"><animateMotion dur="${dur(cycle, ctx.speed)}s" begin="${begin}s" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion></circle>`;
    }
  );
  return flowing.replace(
    /<g class="pele-ishikawa-head([^"]*)"/,
    `<g class="pele-ishikawa-head$1 ${ctx.pfx}-beat"`
  );
}

/** A gentle heartbeat for what everything flows into (the Ishikawa effect). */
export function beatCss(pfx: string, speed: number): string {
  return `
      .${pfx}-beat { transform-box: fill-box; transform-origin: center; animation: ${pfx}-beat ${(3.2 / speed).toFixed(2)}s ease-in-out infinite; }
      @keyframes ${pfx}-beat { 0%, 70%, 100% { scale: 1; } 85% { scale: 1.05; } }
      @media (prefers-reduced-motion: reduce) { .${pfx}-beat { animation: none; } }`;
}
