"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAppStore } from "@/stores/app-store";
import { DepartmentNode } from "./DepartmentNode";
import { AgentNode } from "./AgentNode";
import { SkillNode, McpToolNode, PluginNode } from "./EntityNode";
import { cn } from "@/lib/utils";

const nodeTypes = {
  department: DepartmentNode,
  agent: AgentNode,
  skill: SkillNode,
  mcp_tool: McpToolNode,
  plugin: PluginNode,
};

const edgeStyles: Record<string, React.CSSProperties> = {
  "belongs-to": { stroke: "#64748B", strokeWidth: 2 },
  "has-skill": { stroke: "#8B5CF6", strokeWidth: 1, strokeDasharray: "6 3" },
  "uses-tool": { stroke: "#3B82F6", strokeWidth: 1 },
  "uses-plugin": { stroke: "#F59E0B", strokeWidth: 1, strokeDasharray: "2 2" },
};

type FilterKey = "skills" | "mcpTools" | "plugins";

export function GraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    skills: true,
    mcpTools: true,
    plugins: true,
  });
  const selectAgent = useAppStore((s) => s.selectAgent);
  const selectDepartment = useAppStore((s) => s.selectDepartment);

  const currentOrgId = useAppStore((s) => s.currentOrgId);

  useEffect(() => {
    if (!currentOrgId) return;
    fetch(`/api/organizations/${currentOrgId}/graph`)
      .then((res) => res.json())
      .then((data: { nodes: Node[]; edges: Edge[] }) => {
        setNodes(data.nodes);
        setEdges(
          data.edges.map((e: Edge) => ({
            ...e,
            style: edgeStyles[(e.data as { relationship: string })?.relationship] ?? {},
            animated: false,
          })),
        );
      });
  }, [currentOrgId, setNodes, setEdges]);

  // Filter nodes/edges based on toggle state
  const hiddenTypes = useMemo(() => {
    const hidden = new Set<string>();
    if (!filters.skills) hidden.add("skill");
    if (!filters.mcpTools) hidden.add("mcp_tool");
    if (!filters.plugins) hidden.add("plugin");
    return hidden;
  }, [filters]);

  const filteredNodes = useMemo(
    () => nodes.map((n) => ({ ...n, hidden: hiddenTypes.has(n.type ?? "") })),
    [nodes, hiddenTypes],
  );

  const filteredEdges = useMemo(
    () =>
      edges.map((e) => {
        const targetNode = nodes.find((n) => n.id === e.target);
        const hidden = targetNode ? hiddenTypes.has(targetNode.type ?? "") : false;
        return { ...e, hidden };
      }),
    [edges, nodes, hiddenTypes],
  );

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

  const toggleFilter = (key: FilterKey) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px - 40px)" }}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500 mr-1">Show:</span>
        {([
          { key: "skills" as FilterKey, label: "Skills", color: "#8B5CF6" },
          { key: "mcpTools" as FilterKey, label: "MCP Tools", color: "#3B82F6" },
          { key: "plugins" as FilterKey, label: "Plugins", color: "#F59E0B" },
        ]).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              filters[key]
                ? "text-white"
                : "bg-white text-slate-400 border-slate-200",
            )}
            style={
              filters[key]
                ? { backgroundColor: color, borderColor: color }
                : undefined
            }
          >
            {label}
          </button>
        ))}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-slate-400" /> belongs-to
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t border-dashed border-purple-500" /> has-skill
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t border-blue-500" /> uses-tool
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t border-dotted border-amber-500" /> uses-plugin
          </span>
        </div>
      </div>

      {/* React Flow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "department") return "#64748B";
              if (n.type === "agent") return "#3B82F6";
              if (n.type === "skill") return "#8B5CF6";
              if (n.type === "mcp_tool") return "#3B82F6";
              if (n.type === "plugin") return "#F59E0B";
              return "#94A3B8";
            }}
            maskColor="rgba(0,0,0,0.08)"
            className="!bg-slate-50 !border-slate-200"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
