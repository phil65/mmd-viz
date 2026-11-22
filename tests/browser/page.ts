// Bundled into the browser test page: renders diagrams and exposes the controllers
import { render } from "pele/core";
import "../../src/diagrams.js";
import { animateSvg } from "../../src/embed.js";
import { fold } from "../../src/fold.js";
import { renderAnimatedSvg } from "../../src/index.js";
import { interactive } from "../../src/interactive.js";

const SOURCES: Record<string, string> = {
  flowchart: "flowchart LR\n  a[A] --> hub[Hub]\n  b[B] --> hub\n  hub --> c[C]\n  d[D] --> e[E]",
  state: "stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy: go\n  Busy --> Done: finish",
  sequence: "sequenceDiagram\n  A->>B: one\n  B->>C: two\n  C-->>A: three",
  gitGraph: 'gitGraph\n  commit id: "a"\n  branch feat\n  checkout feat\n  commit id: "b"\n  checkout main\n  merge feat',
  sankey: "sankey-beta\n  A,B,10\n  B,C,6\n  B,D,4\n  X,D,3",
  subgraphs: "flowchart LR\n  u --> api\n  subgraph backend [Backend]\n    api --> db\n  end",
};

const api: Record<string, unknown> = {};
for (const [name, source] of Object.entries(SOURCES)) {
  for (const mode of ["framed", "embed"] as const) {
    const box = document.createElement("div");
    box.id = `${name}-${mode}`;
    if (mode === "framed") box.innerHTML = renderAnimatedSvg(source, { animate: false, idPrefix: `${name}f` });
    else {
      const drawn = render(source, { responsive: false, idPrefix: `${name}e-` });
      box.innerHTML = animateSvg(drawn.svg, drawn.type, { idPrefix: `${name}e` });
    }
    document.body.append(box);
    const type = name === "subgraphs" ? "flowchart" : name;
    api[box.id] = interactive(box.querySelector("svg")!, { type });
  }
}
(window as unknown as { api: unknown; foldFlow: unknown }).api = api;
// Folding a subgraph: the redrawn chart has one node for it
(window as unknown as { foldFlow: () => string[] }).foldFlow = () => {
  const folded = fold(SOURCES.subgraphs!, "flowchart", new Set(["backend"]))!;
  const svg = render(folded.model!).svg;
  return [...svg.matchAll(/<g class="pele-node[^"]*" data-id="([^"]*)"/g)].map((m) => m[1]!);
};
