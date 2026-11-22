# mmd-viz

Turn standard Mermaid diagrams into sleek, **zero-JS animated SVGs**—ready for GitHub READMEs, static docs, and light/dark themes.

Powered by [`pele`](https://github.com/obsidianmd/pele) (synchronous, zero-DOM Mermaid layout engine).

![mmd-viz architecture](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/architecture.svg)

### More Examples

**Subgraphs, decision diamonds, edge labels & feedback loops:**

![Agentic loop with subgraphs and edge labels](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/complex-loop.svg)

**Light theme (top-down flowchart):**

![Light theme top-down architecture](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/light-td.svg)

**Sequence diagrams (chronological message relay):**

![Sequence diagram](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/sequence.svg)

**State machines (`stateDiagram-v2`):**

![State machine](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/state.svg)

**Git graphs (`gitGraph`):**

![Git graph](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/gitgraph.svg)

**Tokyo Night theme + thick (`==>`) & dotted (`-.->`) edge weights:**

![Tokyo Night theme](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/tokyo-night.svg)

**Architecture (`architecture-beta`):**

![Architecture beta](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/arch-beta.svg)

**Sankey (`sankey-beta` centerline particle streams):**

![Sankey flow](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/sankey.svg)

**Gantt (`gantt` with sweeping playhead):**

![Gantt roadmap](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/gantt.svg)

**Timeline (`timeline` axis & pulsing milestones):**

![Timeline](https://raw.githubusercontent.com/phil65/mmd-viz/main/assets/timeline.svg)

## Features

- **Zero JS in output** — pure CSS `@keyframes` + SMIL `<animateMotion>`, so animations work directly inside GitHub `<img>` tags.
- **No browser / Puppeteer required** — synchronous rendering in milliseconds.
- **8 built-in themes + `--theme auto`** — `dark`, `light`, `auto` (OS `prefers-color-scheme`), `tokyo-night`, `catppuccin`, `nord`, `github-dark`, `github-light`.
- **8 animated temporal/flow diagram types** — `flowchart` (with thick `==>` / dotted `-.->` edge weights), chronological `sequenceDiagram` relays, `stateDiagram-v2` transitions, `gitGraph` branches & commits, `architecture-beta` service traffic, `sankey-beta` centerline ribbon streams, `gantt` sweeping playhead, and `timeline` axis & milestone pulses. See [DIAGRAMS.md](./DIAGRAMS.md) for the full 32-diagram support matrix.
- **Batch CLI mode** — pass a directory to recursively render all `*.mmd` files to `*.svg`.
- **Accessible & portable** — respects `prefers-reduced-motion`, uses negative `begin` offsets so no particles park at `(0, 0)` on frame 0, and supports `--transparent`, `--speed`, and `--static`.

## CLI Usage

```bash
# Single file
npx mmd-viz diagram.mmd -o diagram.svg

# Batch-render a directory of *.mmd files
npx mmd-viz docs/diagrams -o docs/assets --theme auto

# From stdin with theme, speed, title, and footer
cat diagram.mmd | npx mmd-viz \
  --title "Architecture" \
  --footer "define once in YAML" \
  --theme tokyo-night \
  --speed 1.2 \
  -o diagram.svg

# Transparent background or static (no animations)
npx mmd-viz diagram.mmd --transparent --static -o diagram.svg
```

## TypeScript / JavaScript API

```bash
npm install mmd-viz
```

```ts
import { renderAnimatedSvg } from "mmd-viz";

const svg = renderAnimatedSvg(
  `flowchart LR
    native["Native Agent<br/>PydanticAI · Tools"]:::cyan --> hub(["AgentPool<br/>MessageNode"]):::hub
    acp["ACP Agent<br/>Goose · Codex"]:::indigo --> hub
    hub --> server["ACP Server<br/>Zed · VS Code"]:::emerald
  `,
  {
    title: "AgentPool",
    footer: "define once in YAML",
    theme: "dark", // "dark" | "light"
    animate: true,
  }
);
```

## Mermaid Styling Conventions

Everything is standard Mermaid syntax:

| Convention | Effect |
| :--- | :--- |
| `:::cyan`, `:::indigo`, `:::amber`, `:::emerald`, `:::pink`, `:::rose`, `:::violet` | Adds a colored card accent bar and color-matches connected wires, arrowheads, and animated packets. |
| `:::hub` | Highlights a focal node with a gradient fill, monospace subtitle, and pulsing outer ring. |
| `"Title<br/>Subtitle"` | Renders line 1 as bold title and line 2 as muted subtitle. |

## License

MIT
