"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useAppStore } from "@/stores/app-store";
import { DepartmentNode } from "@/components/graph/DepartmentNode";
import { AgentNode } from "@/components/graph/AgentNode";
import { OrgNode } from "./OrgNode";

const nodeTypes = {
  organization: OrgNode,
  department: DepartmentNode,
  agent: AgentNode,
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 100, nodesep: 60 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export function OrgChartPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const selectDepartment = useAppStore((s) => s.selectDepartment);
  const currentOrgId = useAppStore((s) => s.currentOrgId);
  const organization = useAppStore((s) => s.organization);

  useEffect(() => {
    if (!currentOrgId) return;
    fetch(`/api/organizations/${currentOrgId}/graph`)
      .then((res) => res.json())
      .then((data: { nodes: Node[]; edges: Edge[] }) => {
        // Filter to only dept and agent nodes
        const deptNodes = data.nodes.filter((n) => n.type === "department");
        const agentNodes = data.nodes.filter((n) => n.type === "agent");
        const belongsToEdges = data.edges.filter(
          (e) => (e.data as { relationship: string })?.relationship === "belongs-to",
        );

        // Add org root node
        const orgNode: Node = {
          id: "org-root",
          type: "organization",
          position: { x: 0, y: 0 },
          data: {
            name: organization.name,
            departmentCount: organization.departments.length,
            totalBudget: organization.totalBudget,
          },
        };

        // Build dept hierarchy edges using parentId
        // Top-level depts (no parentId) connect to org root
        // Child depts connect to their parent dept
        const deptHierarchyEdges: Edge[] = deptNodes.map((n) => {
          const parentId = (n.data as { parentId: string | null }).parentId;
          if (parentId) {
            return {
              id: `e-dept-${n.id}-parent`,
              source: `dept-${parentId}`,
              target: n.id,
              type: "smoothstep",
              data: { relationship: "belongs-to" },
            };
          }
          return {
            id: `e-org-${n.id}`,
            source: "org-root",
            target: n.id,
            type: "smoothstep",
            data: { relationship: "belongs-to" },
          };
        });

        // Only connect agents to leaf departments (depts that have no children)
        // For the tree: org → dept-L1 → dept-L2 → ... → dept-leaf → agents
        const parentDeptIds = new Set(
          deptNodes
            .map((n) => (n.data as { parentId: string | null }).parentId)
            .filter((id): id is string => id !== null),
        );

        // Flip agent→dept edges to dept→agent, only for leaf depts
        const deptToAgentEdges: Edge[] = belongsToEdges
          .filter((e) => {
            // e.target is dept node id like "dept-xxx", e.source is agent node
            const deptNodeId = e.target;
            const rawDeptId = deptNodeId.replace("dept-", "");
            // Include agent if its dept is a leaf (not a parent of any other dept)
            return !parentDeptIds.has(rawDeptId);
          })
          .map((e) => ({
            ...e,
            source: e.target,
            target: e.source,
            type: "smoothstep",
          }));

        // For non-leaf depts, still include agents but connect them
        const nonLeafAgentEdges: Edge[] = belongsToEdges
          .filter((e) => {
            const rawDeptId = e.target.replace("dept-", "");
            return parentDeptIds.has(rawDeptId);
          })
          .map((e) => ({
            ...e,
            source: e.target,
            target: e.source,
            type: "smoothstep",
          }));

        const allNodes = [orgNode, ...deptNodes, ...agentNodes];
        const allEdges = [...deptHierarchyEdges, ...deptToAgentEdges, ...nonLeafAgentEdges];

        const laidOutNodes = applyDagreLayout(allNodes, allEdges);
        setNodes(laidOutNodes);
        setEdges(
          allEdges.map((e) => ({
            ...e,
            style: { stroke: "#64748B", strokeWidth: 2 },
          })),
        );
      });
  }, [currentOrgId, organization, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "department") {
        const deptId = node.id.replace("dept-", "");
        selectDepartment(deptId);
      } else if (node.type === "agent") {
        const agentId = (node.data as { agentId: string }).agentId;
        selectAgent(agentId);
      }
    },
    [selectAgent, selectDepartment],
  );

  const nodeColor = useMemo(
    () => (n: Node) => {
      if (n.type === "organization") return "#1E293B";
      if (n.type === "department") return "#64748B";
      if (n.type === "agent") return "#3B82F6";
      return "#94A3B8";
    },
    [],
  );

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px - 40px)" }}>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={nodeColor}
            maskColor="rgba(0,0,0,0.08)"
            className="!bg-slate-50 !border-slate-200"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
