import { render } from "pele";
import { describe, expect, it } from "vitest";
import { animateSvg, loops } from "../src/embed.js";

const drawn = (source: string) => {
  const { svg, type } = render(source);
  return { svg, type };
};

describe("animateSvg (embed in an app)", () => {
  const flow = drawn("flowchart LR\n  a[Start] --> b[Work]\n  b --> c[Done]");

  it("keeps pele's root element and drawing, and adds the motion", () => {
    const out = animateSvg(flow.svg, flow.type, { idPrefix: "d1" });
    expect(out.slice(0, out.indexOf(">") + 1)).toBe(flow.svg.slice(0, flow.svg.indexOf(">") + 1));
    expect(out).toContain("<animateMotion");
    expect(out).toContain(".d1-flow");
    expect(out.endsWith("</svg>")).toBe(true);
  });

  it("uses the host's colors and no frame of its own", () => {
    const out = animateSvg(flow.svg, flow.type);
    expect(out).toContain('fill="var(--_c)"');
    expect(out).not.toContain("#38BDF8");
    expect(out).not.toMatch(/mmd-card|mmd-bg|mmd-title/);
    // Nodes stay as pele drew them (no accent bars)
    expect(out.match(/<rect /g)?.length).toBe(flow.svg.match(/<rect /g)?.length);
  });

  it("builds structure and data up once", () => {
    const pie = drawn('pie\n  "a" : 2\n  "b" : 1');
    const out = animateSvg(pie.svg, pie.type);
    expect(out).toContain("mmd-fx-bloom");
    expect(out).not.toContain("<animateMotion");
    expect(loops("pie")).toBe(false);
    expect(loops("flowchart")).toBe(true);
    expect(loops("sequence")).toBe(true);
  });

  it("keeps series colors of sankey ribbons and git branches", () => {
    const sankey = drawn("sankey-beta\n  A,B,10\n  A,C,5");
    expect(animateSvg(sankey.svg, sankey.type)).toMatch(/<circle r="[^"]+" fill="var\(--pele-series-/);
    const git = drawn("gitGraph\n  commit\n  branch f\n  commit\n  checkout main\n  merge f");
    expect(animateSvg(git.svg, git.type)).toContain("mmd-flash");
  });

  it("rejects what isn't an SVG", () => {
    expect(() => animateSvg("<div/>", "flowchart")).toThrow();
  });
});
