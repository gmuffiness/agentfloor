import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import type { Organization, Department, Agent, Skill, Plugin, McpTool, MonthlyCost, DailyUsage } from "@/types";

interface GraphNode {
  id: string;
  type: "department" | "agent" | "skill" | "mcp_tool" | "plugin";
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data: { relationship: string };
}

function buildGraph(org: Organization) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const skillMap = new Map<string, { node: GraphNode; agentIds: string[] }>();
  const mcpMap = new Map<string, { node: GraphNode; agentIds: string[] }>();
  const pluginMap = new Map<string, { node: GraphNode; agentIds: string[] }>();

  const deptSpacing = 320;
  const deptY = 40;

  org.departments.forEach((dept: Department, deptIdx: number) => {
    const deptX = 100 + deptIdx * deptSpacing;

    nodes.push({
      id: `dept-${dept.id}`,
      type: "department",
      position: { x: deptX, y: deptY },
      data: {
        name: dept.name,
        agentCount: dept.agents.length,
        budget: dept.budget,
        monthlySpend: dept.monthlySpend,
        vendor: dept.primaryVendor,
      },
    });

    dept.agents.forEach((agent: Agent, agentIdx: number) => {
      const agentX = deptX - 40 + (agentIdx % 2) * 160;
      const agentY = deptY + 160 + Math.floor(agentIdx / 2) * 140;

      nodes.push({
        id: `agent-${agent.id}`,
        type: "agent",
        position: { x: agentX, y: agentY },
        data: {
          name: agent.name,
          vendor: agent.vendor,
          model: agent.model,
          status: agent.status,
          monthlyCost: agent.monthlyCost,
          agentId: agent.id,
        },
      });

      edges.push({
        id: `e-agent-${agent.id}-dept-${dept.id}`,
        source: `agent-${agent.id}`,
        target: `dept-${dept.id}`,
        type: "default",
        data: { relationship: "belongs-to" },
      });

      for (const skill of agent.skills) {
        const key = skill.id;
        if (!skillMap.has(key)) {
          skillMap.set(key, {
            node: {
              id: `skill-${skill.id}`,
              type: "skill",
              position: { x: 0, y: 0 },
              data: { name: skill.name, icon: skill.icon, category: skill.category },
            },
            agentIds: [],
          });
        }
        skillMap.get(key)!.agentIds.push(agent.id);
      }

      for (const tool of agent.mcpTools) {
        const key = tool.id;
        if (!mcpMap.has(key)) {
          mcpMap.set(key, {
            node: {
              id: `mcp-${tool.id}`,
              type: "mcp_tool",
              position: { x: 0, y: 0 },
              data: { name: tool.name, icon: tool.icon, category: tool.category, server: tool.server },
            },
            agentIds: [],
          });
        }
        mcpMap.get(key)!.agentIds.push(agent.id);
      }

      for (const plugin of agent.plugins) {
        const key = plugin.id;
        if (!pluginMap.has(key)) {
          pluginMap.set(key, {
            node: {
              id: `plugin-${plugin.id}`,
              type: "plugin",
              position: { x: 0, y: 0 },
              data: { name: plugin.name, icon: plugin.icon, version: plugin.version },
            },
            agentIds: [],
          });
        }
        pluginMap.get(key)!.agentIds.push(agent.id);
      }
    });
  });

  const maxAgentY = Math.max(
    ...nodes.filter((n) => n.type === "agent").map((n) => n.position.y),
    400,
  );
  const entityBaseY = maxAgentY + 180;

  let entityIdx = 0;
  const entitySpacing = 180;
  const entityCols = Math.max(6, org.departments.length * 2);

  function placeEntity(entry: { node: GraphNode; agentIds: string[] }) {
    const col = entityIdx % entityCols;
    const row = Math.floor(entityIdx / entityCols);
    entry.node.position = {
      x: 60 + col * entitySpacing,
      y: entityBaseY + row * 100,
    };
    nodes.push(entry.node);
    entityIdx++;
  }

  for (const [, entry] of skillMap) {
    placeEntity(entry);
    for (const agentId of entry.agentIds) {
      edges.push({
        id: `e-agent-${agentId}-${entry.node.id}`,
        source: `agent-${agentId}`,
        target: entry.node.id,
        type: "default",
        data: { relationship: "has-skill" },
      });
    }
  }

  for (const [, entry] of mcpMap) {
    placeEntity(entry);
    for (const agentId of entry.agentIds) {
      edges.push({
        id: `e-agent-${agentId}-${entry.node.id}`,
        source: `agent-${agentId}`,
        target: entry.node.id,
        type: "default",
        data: { relationship: "uses-tool" },
      });
    }
  }

  for (const [, entry] of pluginMap) {
    placeEntity(entry);
    for (const agentId of entry.agentIds) {
      edges.push({
        id: `e-agent-${agentId}-${entry.node.id}`,
        source: `agent-${agentId}`,
        target: entry.node.id,
        type: "default",
        data: { relationship: "uses-plugin" },
      });
    }
  }

  return { nodes, edges };
}

async function loadOrganization(orgId: string): Promise<Organization | null> {
  const supabase = getSupabase();

  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  if (!org) return null;

  const { data: deptRows } = await supabase
    .from("departments")
    .select("*")
    .eq("org_id", org.id);

  const { data: allSkills } = await supabase.from("skills").select("*");
  const skillMap = new Map((allSkills ?? []).map((s) => [s.id, s]));

  const depts: Department[] = [];

  for (const dept of deptRows ?? []) {
    const { data: agentRows } = await supabase.from("agents").select("*").eq("dept_id", dept.id);
    const agentList: Agent[] = [];

    for (const agent of agentRows ?? []) {
      const { data: agentSkillRows } = await supabase
        .from("agent_skills")
        .select("skill_id")
        .eq("agent_id", agent.id);
      const skills: Skill[] = (agentSkillRows ?? [])
        .map((as) => skillMap.get(as.skill_id))
        .filter((s): s is Skill => s !== undefined) as Skill[];

      const { data: pluginRows } = await supabase.from("plugins").select("*").eq("agent_id", agent.id);
      const plugins: Plugin[] = (pluginRows ?? []).map((p) => ({
        id: p.id, name: p.name, icon: p.icon, description: p.description, version: p.version, enabled: p.enabled,
      }));

      const { data: mcpRows } = await supabase.from("mcp_tools").select("*").eq("agent_id", agent.id);
      const mcpTools: McpTool[] = (mcpRows ?? []).map((m) => ({
        id: m.id, name: m.name, server: m.server, icon: m.icon, description: m.description,
        category: m.category as McpTool["category"],
      }));

      const { data: usageRows } = await supabase.from("usage_history").select("*").eq("agent_id", agent.id);
      const usageHistory: DailyUsage[] = (usageRows ?? []).map((u) => ({
        date: u.date, tokens: u.tokens, cost: u.cost, requests: u.requests,
      }));

      agentList.push({
        id: agent.id, name: agent.name, description: agent.description,
        vendor: agent.vendor as Agent["vendor"], model: agent.model,
        status: agent.status as Agent["status"],
        monthlyCost: agent.monthly_cost, tokensUsed: agent.tokens_used,
        position: { x: agent.pos_x, y: agent.pos_y },
        skills, plugins, mcpTools, resources: [], usageHistory,
        lastActive: agent.last_active, createdAt: agent.created_at,
      });
    }

    const { data: costRows } = await supabase.from("cost_history").select("*").eq("dept_id", dept.id);
    const costHistory: MonthlyCost[] = (costRows ?? []).map((c) => ({
      month: c.month, amount: c.amount,
      byVendor: { anthropic: c.anthropic, openai: c.openai, google: c.google },
    }));

    depts.push({
      id: dept.id, name: dept.name, description: dept.description,
      budget: dept.budget, monthlySpend: dept.monthly_spend,
      layout: { x: dept.layout_x, y: dept.layout_y, width: dept.layout_w, height: dept.layout_h },
      primaryVendor: dept.primary_vendor as Department["primaryVendor"],
      agents: agentList, costHistory,
    });
  }

  return {
    id: org.id, name: org.name, totalBudget: org.total_budget, departments: depts,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const org = await loadOrganization(orgId);
  if (!org) {
    return NextResponse.json({ nodes: [], edges: [] });
  }
  const graph = buildGraph(org);
  return NextResponse.json(graph);
}
