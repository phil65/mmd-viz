/**
 * Registers every pele diagram type with pele/core, the instance mindmap.ts
 * shares (pele's main entry is a separate bundle that would not accept its models).
 */
import { register } from "pele/core";
import agentflowDiagram from "pele/diagrams/agentflow";
import architectureDiagram from "pele/diagrams/architecture";
import blockDiagram from "pele/diagrams/block";
import c4 from "pele/diagrams/c4";
import classDiagram from "pele/diagrams/class";
import cynefinDiagram from "pele/diagrams/cynefin";
import erDiagram from "pele/diagrams/er";
import eventmodelingDiagram from "pele/diagrams/eventmodeling";
import flowchartDiagram from "pele/diagrams/flowchart";
import ganttDiagram from "pele/diagrams/gantt";
import gitGraphDiagram from "pele/diagrams/gitGraph";
import infoDiagram from "pele/diagrams/info";
import ishikawaDiagram from "pele/diagrams/ishikawa";
import journeyDiagram from "pele/diagrams/journey";
import kanbanDiagram from "pele/diagrams/kanban";
import mindmapDiagram from "pele/diagrams/mindmap";
import packetDiagram from "pele/diagrams/packet";
import pieDiagram from "pele/diagrams/pie";
import quadrantChartDiagram from "pele/diagrams/quadrantChart";
import radarDiagram from "pele/diagrams/radar";
import railroadDiagram from "pele/diagrams/railroad";
import requirementDiagram from "pele/diagrams/requirement";
import sankeyDiagram from "pele/diagrams/sankey";
import sequenceDiagram from "pele/diagrams/sequence";
import stateDiagram from "pele/diagrams/state";
import swimlaneDiagram from "pele/diagrams/swimlane";
import timelineDiagram from "pele/diagrams/timeline";
import treeViewDiagram from "pele/diagrams/treeView";
import treemapDiagram from "pele/diagrams/treemap";
import usecaseDiagram from "pele/diagrams/usecase";
import vennDiagram from "pele/diagrams/venn";
import wardleyDiagram from "pele/diagrams/wardley";
import xychartDiagram from "pele/diagrams/xychart";

register(
  agentflowDiagram,
  architectureDiagram,
  blockDiagram,
  c4,
  classDiagram,
  cynefinDiagram,
  erDiagram,
  eventmodelingDiagram,
  flowchartDiagram,
  ganttDiagram,
  gitGraphDiagram,
  infoDiagram,
  ishikawaDiagram,
  journeyDiagram,
  kanbanDiagram,
  mindmapDiagram,
  packetDiagram,
  pieDiagram,
  quadrantChartDiagram,
  radarDiagram,
  railroadDiagram,
  requirementDiagram,
  sankeyDiagram,
  sequenceDiagram,
  stateDiagram,
  swimlaneDiagram,
  timelineDiagram,
  treeViewDiagram,
  treemapDiagram,
  usecaseDiagram,
  vennDiagram,
  wardleyDiagram,
  xychartDiagram,
);
