# Diagram Type Support

All **32** diagram types supported by [`pele`](https://github.com/obsidianmd/pele) automatically receive `mmd-viz`'s self-contained SVG canvas, typography, `--pele-series-1..5` color palette, 8 themes (including `--theme auto`), `--title` / `--footer`, `--transparent`, `--static`, and `prefers-reduced-motion` support.

On top of that base styling, **time- and flow-oriented** diagrams receive tailored zero-JS animations (CSS `@keyframes` + SMIL `<animateMotion>` / `<animateTransform>`).

---

## Animated (11)

| Pele Type | Mermaid Syntax | Animation Behavior | Notes / Conventions |
| :--- | :--- | :--- | :--- |
| `flowchart` | `flowchart LR` / `TD`, `graph` | Two-layer dashed wires + traveling packets along Bézier edges; pulsing `:::hub` ring | Supports `:::cyan`, `:::indigo`, `:::amber`, `:::emerald`, `:::pink`, `:::rose`, `:::violet`, `:::hub`, `<br/>` title/subtitle, `==>` thick & `-.->` dotted weights, subgraphs, edge labels |
| `sequence` | `sequenceDiagram` | **Chronological relay** — packets fire sequentially in order (`1 → 2 → 3 → …`) with synchronized opacity | Preserves dashed return arrows (`-->>`) |
| `state` | `stateDiagram-v2` | Cycling accent transition arrows + dashed flow + traveling packets | Auto-expands narrow vertical canvases to fit titles/footers |
| `gitGraph` | `gitGraph` | Cycling branch/merge colors + animated branch/merge packets + staggered pulsing commit halos | Uses `--pele-series-1..5` for branch badges & lanes |
| `architecture` | `architecture-beta` | Cycling accent service-to-service traffic wires + traveling packets | Preserves Pele service & group icons |
| `agentflow` | `agentflow-beta` | Animated agent handoff & tool-call packets along edges | Supports `:::accent` classes or automatic cycling accents |
| `c4` | `C4Context` / `C4Container` / `C4Component` | Cycling accent traffic wires & packets along relationship arrows | Preserves C4 person/system shapes |
| `swimlane` | `swimlane-beta` | Animated cross-lane handoff wires & packets | Preserves horizontal/vertical lane headers |
| `sankey` | `sankey-beta` | Dual staggered particles streaming along the exact mathematical centerline Bézier of each weighted ribbon | Color-matched to each ribbon's series accent |
| `gantt` | `gantt` | Cycling accent task bars + sweeping vertical playhead line across the timeline grid | Respects `--speed` multiplier |
| `timeline` | `timeline` | Glowing dashed axis + traveling pulse + staggered pulsing rings on milestone dots | Uses `--pele-series-1..5` for period cards |

---

## Planned Animation Candidates (4)

Temporal, flow, or execution-oriented diagrams that currently receive full theme/canvas styling and are candidates for dedicated animations:

| Pele Type | Mermaid Syntax | Proposed Animation |
| :--- | :--- | :--- |
| `block` | `block-beta` | Directional connector pulses between blocks |
| `eventmodeling` | `eventmodeling` | Chronological left-to-right command → event → view flow |
| `journey` | `journey` | Subtle left-to-right step highlight across user journey stages |
| `railroad` | `railroad-beta` / `railroad-ebnf-beta` | Glowing parser token gliding along the grammar track |

---

## Styled Static by Design (17)

Structural, hierarchical, or analytical diagrams where continuous motion would be distracting rather than informative. All of these receive full `mmd-viz` theming, framed canvas, typography, and `--theme auto` support:

| Category | Pele Types |
| :--- | :--- |
| **Software / Data Modeling** | `class`, `er`, `requirement`, `usecase`, `packet` |
| **Charts & Data Viz** | `pie`, `xychart`, `radar`, `treemap`, `quadrantChart`, `venn` |
| **Thinking / Planning** | `mindmap`, `kanban`, `wardley`, `cynefin`, `ishikawa`, `treeView`, `info` |

`mindmap` is the exception: drawn from a Markdown outline (`renderMindmapSvg`, `*.mindmap.md`), it grows once from the root when animated.
