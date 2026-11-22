import { describe, expect, it } from "vitest";
import { renderAnimatedSvg } from "../src/index.js";

const fx = (svg: string, kind: string) =>
  (svg.match(new RegExp(`class="[^"]*\\bmmd-fx-${kind}\\b`, "g")) ?? []).length;
const motions = (svg: string) => (svg.match(/<animateMotion/g) ?? []).length;

describe("animations that fit the diagram type", () => {
  it("builds charts up once: pie slices bloom, bars grow, the line draws", () => {
    const pie = renderAnimatedSvg('pie title T\n  "a" : 2\n  "b" : 1');
    expect(fx(pie, "bloom")).toBe(2);
    expect(motions(pie)).toBe(0);

    const xy = renderAnimatedSvg(
      "xychart-beta\n  x-axis [a, b, c]\n  y-axis 0 --> 10\n  bar [2, 5, 8]\n  line [1, 4, 9]"
    );
    expect(fx(xy, "grow-y")).toBe(3);
    expect(fx(xy, "draw")).toBe(1);
    expect(xy).toContain('pathLength="1"');
  });

  it("draws relations of structure diagrams instead of streaming packets", () => {
    const cls = renderAnimatedSvg("classDiagram\n  Animal <|-- Dog\n  Animal <|-- Cat");
    expect(motions(cls)).toBe(0);
    expect(fx(cls, "rise")).toBe(3);
    expect(fx(cls, "draw")).toBe(2);
    // Compartments keep pele's look: no flowchart card or accent bar
    expect(cls).not.toContain('class="mmd-card"');

    const er = renderAnimatedSvg("erDiagram\n  A ||--o{ B : has");
    expect(motions(er)).toBe(0);
    expect(fx(er, "draw")).toBe(1);
  });

  it("relays state transitions one at a time", () => {
    const svg = renderAnimatedSvg("stateDiagram-v2\n  [*] --> A\n  A --> B\n  B --> [*]");
    expect(motions(svg)).toBe(3);
    // A relay packet waits for its turn: motion keyed to its slot in the cycle
    expect(svg).toContain('keyPoints="0;0;1;1"');
    expect(svg).not.toContain('class="mmd-flow"');
  });

  it("replays git history in order, commits flashing as it reaches them", () => {
    const svg = renderAnimatedSvg('gitGraph\n  commit\n  branch f\n  commit\n  checkout main\n  merge f');
    expect(svg).toContain('keyPoints="0;1;1"');
    expect(svg).toContain("mmd-flash");
  });

  it("gives journeys, railroads and Ishikawa diagrams their own motion", () => {
    const journey = renderAnimatedSvg("journey\n  section S\n    a: 5: Me\n    b: 2: Me");
    expect(motions(journey)).toBe(1);
    expect(fx(journey, "pop")).toBe(2);

    const railroad = renderAnimatedSvg('railroad-ebnf-beta\n  a = "x" , { "y" } ;');
    expect(motions(railroad)).toBe(1);
    expect(railroad).toContain('class="mmd-flow"');

    const ishikawa = renderAnimatedSvg("ishikawa-beta\n  Effect\n    A\n      a1\n    B\n      b1");
    expect(motions(ishikawa)).toBe(2);
    expect(ishikawa).toContain("mmd-beat");
  });

  it("colors every gantt task and keeps labels readable", () => {
    const svg = renderAnimatedSvg(
      "gantt\n  dateFormat YYYY-MM-DD\n  section S\n  A :done, a, 2026-01-01, 2d\n  B :active, b, after a, 2d\n  C :crit, c, after b, 1d"
    );
    expect(svg).toContain('fill-opacity="0.18"');
    expect(svg).toContain("mmd-working");
    expect(svg).toContain("var(--pele-critical");
    expect(svg).toContain(".pele-task .pele-label[fill]");
  });

  it("animates nothing with animate: false, and every build-up honors reduced motion", () => {
    const sources = [
      'pie\n  "a" : 1',
      "kanban\n  t[Todo]\n    a[A]",
      "packet-beta\n  0-7: \"x\"",
      "treeView-beta\n  a\n    b",
      "venn-beta\n  set A\n  set B",
    ];
    for (const source of sources) {
      expect(renderAnimatedSvg(source, { animate: false })).not.toMatch(/mmd-fx-|<animate/);
      const svg = renderAnimatedSvg(source);
      expect(svg).toMatch(/mmd-fx-/);
      expect(svg).toContain("prefers-reduced-motion: reduce");
    }
  });
});

describe("framed nodes", () => {
  it("gives compact state nodes a card without the accent bar", () => {
    const state = renderAnimatedSvg("stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy", { animate: false });
    expect(state).toContain('class="mmd-card"');
    expect(state).not.toMatch(/width="5" height="[^"]+" rx="2.5"/);
    const flow = renderAnimatedSvg("flowchart LR\n  a[Alpha] --> b[Beta]", { animate: false });
    expect(flow).toMatch(/width="5" height="[^"]+" rx="2.5"/);
  });
});
