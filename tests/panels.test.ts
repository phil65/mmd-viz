import { describe, expect, it } from "vitest";
import { renderAnimatedSvg } from "../src/index.js";
import { ACCENT_PALETTE } from "../src/themes.js";

const VIOLET = ACCENT_PALETTE.violet;
const EMERALD = ACCENT_PALETTE.emerald;

const BLOCKS = `block-beta
  columns 3
  block:clients["Clients"]
    columns 1
    zed["Zed"] toad["Toad"]
  end
  hub["agentpool<br/>agents"]
  block:backends["Agent backends"]
    columns 1
    claude["Claude Code"] codex["Codex"]
  end
  clients --> hub
  hub --> backends
  class hub hub
  class backends violet
`;

/** The markup of the element with `data-id="id"`, up to its closing tag. */
function group(svg: string, cls: string, id: string): string {
  return new RegExp(`<g class="${cls}[^"]*" data-id="${id}"[^>]*>[\\s\\S]*?</g>`).exec(svg)?.[0] ?? "";
}

describe("accented containers (panels)", () => {
  it("turns an accented block-beta block into a panel, its blocks into chips", () => {
    const svg = renderAnimatedSvg(BLOCKS);
    const panel = group(svg, "pele-cluster", "backends");
    expect(panel).toContain("mmd-panel");
    expect(panel).toContain('class="mmd-panel-frame"');
    expect(panel).toContain(`fill:color-mix(in srgb,${VIOLET} 75%,var(--mv-fg))`);
    expect(panel).toContain('text-anchor="start"');

    const chip = group(svg, "pele-node", "claude");
    expect(chip).toContain(`<circle cx="`);
    expect(chip).toContain(`fill="${VIOLET}" fill-opacity="0.1"`);
    expect(chip).toContain("mv-chip-label");
    // Chips no edge ends on shrink to chip height
    expect(chip).toContain('height="32"');
  });

  it("colors the wires of an accented container in its color", () => {
    const svg = renderAnimatedSvg(BLOCKS);
    expect(group(svg, "pele-edge", "1-hub-backends")).toContain(`stroke="${VIOLET}"`);
    expect(svg).toMatch(new RegExp(`<circle r="[^"]+" fill="${VIOLET}"><animateMotion`));
  });

  it("leaves containers without an accent and other diagrams as they were", () => {
    const svg = renderAnimatedSvg(BLOCKS);
    const plain = group(svg, "pele-cluster", "clients");
    expect(plain).not.toContain("mmd-panel");
    expect(group(svg, "pele-node", "zed")).not.toContain("mv-chip-label");

    const flow = renderAnimatedSvg("flowchart LR\n  subgraph b [Backend]\n    a --> c\n  end\n");
    expect(flow).not.toContain("mmd-panel");
    expect(flow).not.toContain("mmd-panel-frame {");
  });

  it("styles flowchart subgraphs, nested ones taking their parent's color", () => {
    const svg = renderAnimatedSvg(`flowchart LR
  user --> api
  subgraph backend [Backend]
    api[API] --> db
    subgraph store [Storage]
      db[(Postgres)]
    end
  end
  class backend emerald
`);
    expect(group(svg, "pele-cluster", "backend")).toContain("mmd-panel");
    expect(group(svg, "pele-cluster", "store")).toContain(`--mmd-accent:${EMERALD}`);
    // Edges into the panel take its color
    expect(group(svg, "pele-edge", "L_user_api_0")).toContain(`stroke="${EMERALD}"`);
  });

  it("moves titles pele lifts above the edges into the panel's corner", () => {
    const svg = renderAnimatedSvg(`flowchart TB
  hub --> a & b & c
  subgraph g [Group with a long title]
    a
    b
    c
  end
  class g amber
`);
    const title = /<g class="pele-cluster-title" data-id="g">[\s\S]*?<\/g>/.exec(svg)?.[0];
    if (title) {
      expect(title).toContain("mmd-panel-label");
      expect(title).toContain('text-anchor="start"');
    } else {
      expect(group(svg, "pele-cluster", "g")).toContain("mmd-panel-label");
    }
  });
});

describe("timeline cards", () => {
  const TIMELINE = `timeline
  section 2012–2018
    Kodi : C++ core : Python add-on API
  section 2023
    Docs : Markdown
`;

  it("puts a period's events on one card, as a list", () => {
    const svg = renderAnimatedSvg(TIMELINE);
    expect(svg.match(/class="mmd-period-card"/g)?.length).toBe(2);
    // No box per event any more: a dot and a left-aligned label
    expect(svg).not.toMatch(/<g class="pele-node pele-event"><rect/);
    expect(svg).toMatch(/<g class="pele-node pele-event"><circle [^>]+\/><text[^>]*text-anchor="start"/);
  });

  it("keeps the labels on colored pills dark and defines eight series colors", () => {
    const svg = renderAnimatedSvg(TIMELINE, { theme: "light" });
    expect(svg).not.toContain('fill="var(--_bg)"');
    expect(svg).toContain("--pele-series-8:");
  });

  it("leaves the embed style alone", async () => {
    const { animateSvg } = await import("../src/embed.js");
    const { render } = await import("pele/core");
    await import("../src/diagrams.js");
    const { svg, type } = render(TIMELINE);
    expect(animateSvg(svg, type)).not.toContain("period-card");
  });
});
