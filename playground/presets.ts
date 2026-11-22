/** Playground examples: one per diagram type, and a Markdown mind map. */
export interface Preset {
  name: string;
  title: string;
  footer: string;
  source: string;
}

export const PRESETS: Preset[] = [
  {
    name: "Subgraphs (flowchart, click a frame to fold)",
    title: "FLOWCHART · FOLDABLE SUBGRAPHS",
    footer: "click a subgraph to fold it, the folded node to open it",
    source: `flowchart LR
  user[User]:::cyan --> gw
  subgraph backend [Backend]
    gw[Gateway] --> api[API]
    subgraph store [Storage]
      db[(Postgres)]
      cache[(Redis)]
    end
    api --> db
    api --> cache
  end
  api --> mail[Mail]:::amber`,
  },
  {
    name: "Architecture Hub (Flowchart)",
    title: "AGENTPOOL · UNIFIED ORCHESTRATION",
    footer: "define once in YAML · planner | (coder & goose)",
    source: `flowchart LR
  native["Native Agent<br/>PydanticAI · Tools"]:::cyan --> hub(["AgentPool<br/>MessageNode"]):::hub
  acp["ACP Agent<br/>Goose · Codex"]:::indigo --> hub
  claude["Claude Code<br/>CLI · Subagents"]:::amber --> hub
  agui["AG-UI & Teams<br/>Chain | Parallel"]:::emerald --> hub
  hub --> s_acp["ACP Server<br/>Zed · VS Code"]:::cyan
  hub --> s_oc["OpenCode<br/>TUI · Desktop"]:::indigo
  hub --> s_mcp["MCP Server<br/>Tools · Prompts"]:::amber
  hub --> s_agui["AG-UI / OpenAI<br/>Web · REST / SSE"]:::emerald`,
  },
  {
    name: "Sequence Relay (sequenceDiagram)",
    title: "SEQUENCE · CHRONOLOGICAL RELAY",
    footer: "messages fire sequentially: 1 -> 2 -> 3 -> 4",
    source: `sequenceDiagram
  participant IDE as Zed / VS Code
  participant AP as AgentPool
  participant LLM as Model / Tool
  IDE->>AP: session/prompt
  AP->>LLM: stream request
  LLM-->>AP: tool_call + deltas
  AP-->>IDE: session/update`,
  },
  {
    name: "State Machine (stateDiagram-v2)",
    title: "STATE MACHINE · TRANSITIONS",
    footer: "stateDiagram-v2 via Pele",
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Planning: prompt
  Planning --> Executing: plan_ready
  Executing --> Verifying: tool_done
  Verifying --> Executing: retry
  Verifying --> Idle: complete`,
  },
  {
    name: "Git Graph (gitGraph)",
    title: "GITGRAPH · BRANCHES & COMMITS",
    footer: "themed branches & pulsing commits",
    source: `gitGraph
  commit id: "init"
  branch feat/themes
  checkout feat/themes
  commit id: "auto-theme"
  commit id: "sankey"
  checkout main
  merge feat/themes id: "v0.4.0"`,
  },
  {
    name: "Sankey Flow (sankey-beta)",
    title: "SANKEY · CENTERLINE PARTICLES",
    footer: "sankey-beta weighted flow ribbons",
    source: `sankey-beta
  Prompt,Planner,60
  Prompt,Direct,40
  Planner,Coder,35
  Planner,Research,25`,
  },
  {
    name: "Gantt Roadmap (gantt)",
    title: "GANTT · SWEEPING PLAYHEAD",
    footer: "gantt with animated playhead",
    source: `gantt
  dateFormat YYYY-MM-DD
  section Core
  Parser & Layout :a1, 2026-01-01, 5d
  SVG Animator    :a2, after a1, 4d
  section Launch
  npm Release     :a3, after a2, 2d`,
  },
  {
    name: "Timeline (timeline)",
    title: "TIMELINE · AXIS & MILESTONES",
    footer: "axis pulse & pulsing milestone dots",
    source: `timeline
  2025 : Native Agents : MCP Tools
  2026 : ACP Protocol : OpenCode & AG-UI`,
  },
  {
    name: "Service Architecture (architecture-beta)",
    title: "ARCHITECTURE-BETA · SERVICE TRAFFIC",
    footer: "architecture-beta via Pele",
    source: `architecture-beta
  group api(cloud)[API Layer]
  service gw(internet)[Gateway] in api
  service pool(server)[AgentPool] in api
  service db(database)[Storage]
  gw:R --> L:pool
  pool:B --> T:db`,
  },
  {
    name: "Class Diagram (classDiagram)",
    title: "CLASSES · BUILD-UP",
    footer: "",
    source: `classDiagram
  class Animal {
    +String name
    +eat() void
  }
  class Dog {
    +bark() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`,
  },
  {
    name: "Entity Relationship (erDiagram)",
    title: "ENTITIES · BUILD-UP",
    footer: "",
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  CUSTOMER {
    string name
    string email
  }`,
  },
  {
    name: "Pie Chart (pie)",
    title: "PIE · SLICES BLOOM",
    footer: "",
    source: `pie title Traffic
  "Search" : 42
  "Direct" : 28
  "Social" : 18
  "Email" : 12`,
  },
  {
    name: "User Journey (journey)",
    title: "JOURNEY · WALKING THE EXPERIENCE",
    footer: "",
    source: `journey
  title Checkout
  section Browse
    Find product: 5: User
    Read reviews: 3: User
  section Buy
    Pay: 2: User, Shop
    Get receipt: 4: Shop`,
  },
  {
    name: "XY Chart (xychart-beta)",
    title: "XYCHART · BARS GROW",
    footer: "",
    source: `xychart-beta
  title "Revenue"
  x-axis [jan, feb, mar, apr]
  y-axis "k$" 0 --> 100
  bar [20, 45, 60, 80]
  line [15, 40, 55, 90]`,
  },
  {
    name: "Quadrant Chart (quadrantChart)",
    title: "QUADRANTS · POINTS POP",
    footer: "",
    source: `quadrantChart
  title Reach and engagement
  x-axis Low Reach --> High Reach
  y-axis Low Engagement --> High Engagement
  quadrant-1 Expand
  quadrant-2 Promote
  quadrant-3 Re-evaluate
  quadrant-4 Improve
  Campaign A: [0.3, 0.6]
  Campaign B: [0.45, 0.23]
  Campaign C: [0.7, 0.8]`,
  },
  {
    name: "Requirements (requirementDiagram)",
    title: "REQUIREMENTS · BUILD-UP",
    footer: "",
    source: `requirementDiagram
  requirement login {
    id: 1
    text: Users sign in
    risk: high
    verifymethod: test
  }
  element auth {
    type: service
  }
  auth - satisfies -> login`,
  },
  {
    name: "C4 Context (C4Context)",
    title: "C4 · RELATIONSHIP TRAFFIC",
    footer: "",
    source: `C4Context
  Person(u, "Developer")
  System(ap, "AgentPool")
  System_Ext(llm, "Model API")
  Rel(u, ap, "Prompts")
  Rel(ap, llm, "Calls")`,
  },
  {
    name: "Blocks (block-beta)",
    title: "BLOCKS · FLOW",
    footer: "",
    source: `block-beta
  columns 3
  a["Input"] b["Process"] c["Output"]
  a --> b
  b --> c`,
  },
  {
    name: "Packet (packet-beta)",
    title: "PACKET · FIELDS IN BIT ORDER",
    footer: "",
    source: `packet-beta
  0-15: "Source Port"
  16-31: "Destination Port"
  32-63: "Sequence Number"`,
  },
  {
    name: "Kanban Board (kanban)",
    title: "KANBAN · CARDS DROP IN",
    footer: "",
    source: `kanban
  todo[To do]
    t1[Write docs]
    t2[Fix bug]
  doing[Doing]
    t3[Release]
  done[Done]
    t4[Plan]`,
  },
  {
    name: "Radar (radar-beta)",
    title: "RADAR · CURVES BLOOM",
    footer: "",
    source: `radar-beta
  axis speed["Speed"], dx["DX"], docs["Docs"], size["Size"], ecosystem["Ecosystem"]
  curve a["Lib A"]{4, 3, 5, 2, 4}
  curve b["Lib B"]{2, 5, 3, 4, 3}`,
  },
  {
    name: "Treemap (treemap-beta)",
    title: "TREEMAP · TILES",
    footer: "",
    source: `treemap-beta
"Products"
    "Web": 40
    "Mobile": 25
"Services"
    "Support": 20
    "Training": 15`,
  },
  {
    name: "Agent Flow (agentflow-beta)",
    title: "AGENTFLOW · HANDOFFS IN ORDER",
    footer: "",
    source: `agentflow-beta LR
  u["User"] --> p["Planner"] --> t["Tool"]
  p --> c["Coder"]`,
  },
  {
    name: "Use Cases (usecase-beta)",
    title: "USE CASES · ACTORS TO CASES",
    footer: "",
    source: `usecase-beta
  actor User
  actor Admin
  login(Sign in)
  manage(Manage users)
  User --> login
  Admin --> login
  Admin --> manage`,
  },
  {
    name: "Railroad Grammar (railroad-ebnf-beta)",
    title: "RAILROAD · READING THE GRAMMAR",
    footer: "",
    source: `railroad-ebnf-beta
  expr = term , { ("+" | "-") , term } ;
  term = digit , { digit } ;`,
  },
  {
    name: "Tree View (treeView-beta)",
    title: "TREE · TOP-DOWN",
    footer: "",
    source: `treeView-beta
  src
    components
      button.tsx
    index.ts
  package.json`,
  },
  {
    name: "Venn (venn-beta)",
    title: "VENN · SETS",
    footer: "",
    source: `venn-beta
  set A["Design"]
  set B["Code"]
  union A, B["Product"]`,
  },
  {
    name: "Cynefin (cynefin-beta)",
    title: "CYNEFIN · DOMAINS",
    footer: "",
    source: `cynefin-beta
  clear "Clear"
    "Follow the checklist"
  complicated "Complicated"
    "Ask an expert"
  complex "Complex"
    "Probe and sense"
  chaotic "Chaotic"
    "Act first"`,
  },
  {
    name: "Wardley Map (wardley-beta)",
    title: "WARDLEY · VALUE CHAIN",
    footer: "",
    source: `wardley-beta
  title Tea shop
  component Customer [0.95, 0.6]
  component Cup of tea [0.8, 0.7]
  component Kettle [0.4, 0.4]
  Customer -> Cup of tea
  Cup of tea -> Kettle`,
  },
  {
    name: "Swimlanes (swimlane-beta)",
    title: "SWIMLANES · HANDOFFS",
    footer: "",
    source: `swimlane-beta LR
  subgraph Client
    a["Prompt"]
  end
  subgraph Server
    b["Stream"]
    c["Store"]
  end
  a --> b --> c`,
  },
  {
    name: "Ishikawa (ishikawa-beta)",
    title: "ISHIKAWA · CAUSES INTO EFFECT",
    footer: "",
    source: `ishikawa-beta
  Slow builds
    People
      New hires
    Tools
      Old CI
    Process
      No caching`,
  },
  {
    name: "Event Modeling (eventmodeling)",
    title: "EVENT MODEL · COMMAND → EVENT → VIEW",
    footer: "",
    source: `eventmodeling
  tf 01 ui Cart
  tf 02 cmd AddItem
  tf 03 evt ItemAdded
  tf 04 rmo CartItems`,
  },
  {
    name: "Info (info)",
    title: "INFO",
    footer: "",
    source: `info`,
  },
  {
    name: "Mind Map from Markdown (headings & lists)",
    title: "MIND MAP · FROM A MARKDOWN OUTLINE",
    footer: "plain Markdown: # headings, - lists",
    source: `# Product launch

## Research
- User interviews
- Competitor scan

## Build
- **Core** features
  - Editor
  - Sync
- Beta program

## Marketing
- Landing page
- Launch post

## Ship
- [x] Release notes
- [ ] App stores`,
  },
];
