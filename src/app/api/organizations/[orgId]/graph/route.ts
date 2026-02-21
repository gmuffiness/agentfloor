import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";
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
        parentId: dept.parentId,
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

  const [
    { data: deptRows },
    { data: allSkills },
  ] = await Promise.all([
    supabase.from("departments").select("*").eq("org_id", org.id),
    supabase.from("skills").select("*"),
  ]);

  const skillMap = new Map((allSkills ?? []).map((s) => [s.id, s]));
  const deptIds = (deptRows ?? []).map((d) => d.id);

  // Fetch all agents for all departments in one query
  const { data: allAgents } = await supabase
    .from("agents")
    .select("*")
    .in("dept_id", deptIds.length > 0 ? deptIds : ["__none__"]);

  const agentIds = (allAgents ?? []).map((a) => a.id);
  const agentIdFilter = agentIds.length > 0 ? agentIds : ["__none__"];

  // Bulk fetch all agent-related data in parallel
  const [
    { data: allAgentSkills },
    { data: allPlugins },
    { data: allMcpTools },
    { data: allUsageHistory },
    { data: allCostHistory },
  ] = await Promise.all([
    supabase.from("agent_skills").select("agent_id, skill_id").in("agent_id", agentIdFilter),
    supabase.from("plugins").select("*").in("agent_id", agentIdFilter),
    supabase.from("mcp_tools").select("*").in("agent_id", agentIdFilter),
    supabase.from("usage_history").select("*").in("agent_id", agentIdFilter),
    supabase.from("cost_history").select("*").in("dept_id", deptIds.length > 0 ? deptIds : ["__none__"]),
  ]);

  // Group by agent_id / dept_id
  const agentSkillsByAgent = new Map<string, NonNullable<typeof allAgentSkills>>();
  for (const row of allAgentSkills ?? []) {
    if (!agentSkillsByAgent.has(row.agent_id)) agentSkillsByAgent.set(row.agent_id, []);
    agentSkillsByAgent.get(row.agent_id)!.push(row);
  }

  const pluginsByAgent = new Map<string, NonNullable<typeof allPlugins>>();
  for (const row of allPlugins ?? []) {
    if (!pluginsByAgent.has(row.agent_id)) pluginsByAgent.set(row.agent_id, []);
    pluginsByAgent.get(row.agent_id)!.push(row);
  }

  const mcpByAgent = new Map<string, NonNullable<typeof allMcpTools>>();
  for (const row of allMcpTools ?? []) {
    if (!mcpByAgent.has(row.agent_id)) mcpByAgent.set(row.agent_id, []);
    mcpByAgent.get(row.agent_id)!.push(row);
  }

  const usageByAgent = new Map<string, NonNullable<typeof allUsageHistory>>();
  for (const row of allUsageHistory ?? []) {
    if (!usageByAgent.has(row.agent_id)) usageByAgent.set(row.agent_id, []);
    usageByAgent.get(row.agent_id)!.push(row);
  }

  const costByDept = new Map<string, NonNullable<typeof allCostHistory>>();
  for (const row of allCostHistory ?? []) {
    if (!costByDept.has(row.dept_id)) costByDept.set(row.dept_id, []);
    costByDept.get(row.dept_id)!.push(row);
  }

  // Group agents by dept
  const agentsByDept = new Map<string, NonNullable<typeof allAgents>>();
  for (const agent of allAgents ?? []) {
    if (!agentsByDept.has(agent.dept_id)) agentsByDept.set(agent.dept_id, []);
    agentsByDept.get(agent.dept_id)!.push(agent);
  }

  const depts: Department[] = (deptRows ?? []).map((dept) => {
    const deptAgents = agentsByDept.get(dept.id) ?? [];

    const agentList: Agent[] = deptAgents.map((agent) => {
      const skills: Skill[] = (agentSkillsByAgent.get(agent.id) ?? [])
        .map((as) => skillMap.get(as.skill_id))
        .filter((s): s is Skill => s !== undefined) as Skill[];

      const plugins: Plugin[] = (pluginsByAgent.get(agent.id) ?? []).map((p) => ({
        id: p.id, name: p.name, icon: p.icon, description: p.description, version: p.version, enabled: p.enabled,
      }));

      const mcpTools: McpTool[] = (mcpByAgent.get(agent.id) ?? []).map((m) => ({
        id: m.id, name: m.name, server: m.server, icon: m.icon, description: m.description,
        category: m.category as McpTool["category"],
      }));

      const usageHistory: DailyUsage[] = (usageByAgent.get(agent.id) ?? []).map((u) => ({
        date: u.date, tokens: u.tokens, cost: u.cost, requests: u.requests,
      }));

      return {
        id: agent.id, name: agent.name, description: agent.description,
        vendor: agent.vendor as Agent["vendor"], model: agent.model,
        status: agent.status as Agent["status"],
        monthlyCost: agent.monthly_cost, tokensUsed: agent.tokens_used,
        position: { x: agent.pos_x, y: agent.pos_y },
        skills, plugins, mcpTools, resources: [], usageHistory, humanId: null,
        registeredBy: agent.registered_by ?? null,
        runtimeType: agent.runtime_type ?? "api",
        gatewayUrl: agent.gateway_url ?? "",
        lastActive: agent.last_active, createdAt: agent.created_at,
      };
    });

    const costHistory: MonthlyCost[] = (costByDept.get(dept.id) ?? []).map((c) => ({
      month: c.month, amount: c.amount,
      byVendor: { anthropic: c.anthropic, openai: c.openai, google: c.google },
    }));

    return {
      id: dept.id, name: dept.name, description: dept.description,
      parentId: dept.parent_id ?? null,
      budget: dept.budget, monthlySpend: dept.monthly_spend,
      layout: { x: dept.layout_x, y: dept.layout_y, width: dept.layout_w, height: dept.layout_h },
      primaryVendor: dept.primary_vendor as Department["primaryVendor"],
      agents: agentList, costHistory,
    };
  });

  return {
    id: org.id, name: org.name, domain: org.domain ?? "", totalBudget: org.total_budget, visibility: org.visibility ?? "private", departments: depts,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const org = await loadOrganization(orgId);
  if (!org) {
    return NextResponse.json({ nodes: [], edges: [] });
  }
  const graph = buildGraph(org);
  return NextResponse.json(graph);
}
