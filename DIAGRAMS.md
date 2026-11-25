# Diagram Type Support

All **33** diagram types [`pele`](https://github.com/obsidianmd/pele) draws get `mmd-viz`'s self-contained SVG canvas, typography, color palette, 8 themes (including `--theme auto`), `--title` / `--footer`, `--transparent` and `--static`. **Every type is animated**, zero-JS (CSS `@keyframes` + SMIL), in the way that suits what it shows, and every animation stops for `prefers-reduced-motion` (CSS animations stop, SMIL packets and markers are hidden):

- **Flow**: packets keep traveling the edges, for diagrams about traffic and data moving.
- **Relay**: one packet at a time, edge after edge, looping, for diagrams whose edges are steps taken in order.
- **Build-up**: the diagram assembles once (parts appear, relations draw, values grow) and then stays still, for structure and data, where constant motion would only distract.
- **Own motion**: a few types get a motion that is about their meaning.

## Flow

| Pele Type | Mermaid Syntax | Animation |
| :--- | :--- | :--- |
| `flowchart` | `flowchart LR` / `TD`, `graph` | Dashed wires + traveling packets; pulsing `:::hub` ring. `:::cyan` … `:::violet`, `<br/>` title/subtitle, `==>` thick and `-.->` dotted weights |
| `architecture` | `architecture-beta` | Service-to-service traffic packets |
| `c4` | `C4Context` / `C4Container` / `C4Component` | Packets along relationship arrows |
| `block` | `block-beta` | Packets between blocks |
| `swimlane` | `swimlane-beta` | Cross-lane handoff packets |
| `usecase` | `usecase-beta` | Packets from actors to their use cases |
| `sankey` | `sankey-beta` | Particles along each ribbon's centerline, **as many as it carries** (the widest ribbon gets six, the others in proportion) |

## Relay (steps in order)

| Pele Type | Mermaid Syntax | Animation |
| :--- | :--- | :--- |
| `sequence` | `sequenceDiagram` | Messages fire one after another (`1 → 2 → 3 → …`); dashed returns stay dashed |
| `state` | `stateDiagram-v2` | One token walks the transitions in order: the machine is in one state at a time |
| `agentflow` | `agentflow-beta` | Handoffs and tool calls one after another |
| `eventmodeling` | `eventmodeling` | Command → event → view, through the time frames |
| `gitGraph` | `gitGraph` | History replays commit by commit, each commit flashing as the replay reaches it |

## Time

| Pele Type | Mermaid Syntax | Animation |
| :--- | :--- | :--- |
| `gantt` | `gantt` | A playhead sweeps the timeline; tasks in cycling accents, done ones faded, the active one glowing, critical ones red |
| `timeline` | `timeline` | A pulse travels the axis, milestone dots pulse in turn |
| `journey` | `journey` | Tasks and faces appear, the satisfaction line draws, then a marker keeps walking it: the experience over time |

## Own motion

| Pele Type | Mermaid Syntax | Animation |
| :--- | :--- | :--- |
| `railroad` | `railroad-beta` / `railroad-ebnf-beta` / … | Dashes flow along the tracks and a token reads each rule from start to end |
| `ishikawa` | `ishikawa-beta` | Every cause flows down its bone and the spine into the effect, which beats as they arrive |
| `mindmap` | Markdown outline (`renderMindmapSvg`, `*.mindmap.md`) or `mindmap` | Branches grow out of the root, edge before node |

## Build-up (once)

| Pele Type | Mermaid Syntax | Animation |
| :--- | :--- | :--- |
| `class` | `classDiagram` | Classes rise in, then their relations draw (no packets: inheritance isn't traffic) |
| `er` | `erDiagram` | Entities, then relationships, then labels |
| `requirement` | `requirementDiagram` | Requirements and elements, then their relations |
| `wardley` | `wardley-beta` | Components, then the value chain draws |
| `pie` | `pie` | Slices bloom from the center one after another, then labels and legend |
| `xychart` | `xychart-beta` | Bars grow from the axis, lines draw, points pop; in a page, [`interactive`](README.md#interaction-in-a-page-opt-in) highlights a series |
| `radar` | `radar-beta` | Curves bloom from the center, series after series |
| `quadrantChart` | `quadrantChart` | Quadrants fade in, points pop in; in a page, [`interactive`](README.md#interaction-in-a-page-opt-in) highlights the hovered point and can show labels only on hover |
| `treemap` | `treemap-beta` | Sections, then their tiles |
| `venn` | `venn-beta` | Sets pop in, then the regions' labels |
| `kanban` | `kanban` | Cards drop into their columns, column by column |
| `packet` | `packet-beta` | Fields fill in bit order |
| `treeView` | `treeView-beta` | Entries appear top-down, guides fade in |
| `cynefin` | `cynefin-beta` | Domains fade in, the cliff draws, items rise in |
| `info` | `info` | Fades in |

Compartment nodes (class members, ER attributes, requirement fields) keep pele's look; the flowchart card with its accent bar is only for nodes without compartments.
