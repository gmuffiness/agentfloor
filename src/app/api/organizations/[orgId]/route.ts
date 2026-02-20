import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember, requireOrgAdmin } from "@/lib/auth";
import type { Organization, Department, Agent, Skill, Plugin, McpTool, AgentResource, MonthlyCost, DailyUsage } from "@/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const supabase = getSupabase();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Bulk queries — all parallel, no N+1
  const [
    { data: deptRows },
    { data: allSkills },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from("departments").select("*").eq("org_id", org.id),
    supabase.from("skills").select("*"),
    supabase.from("org_members").select("id, name, email, role, status, joined_at").eq("org_id", org.id),
  ]);

  const skillMap = new Map((allSkills ?? []).map((s) => [s.id, s]));
  const memberMap = new Map((memberRows ?? []).map((m) => [m.id, {
    id: m.id,
    orgId: org.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.status,
    joinedAt: m.joined_at,
  }]));

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
    { data: allResources },
    { data: allCostHistory },
  ] = await Promise.all([
    supabase.from("agent_skills").select("agent_id, skill_id").in("agent_id", agentIdFilter),
    supabase.from("plugins").select("*").in("agent_id", agentIdFilter),
    supabase.from("mcp_tools").select("*").in("agent_id", agentIdFilter),
    supabase.from("usage_history").select("*").in("agent_id", agentIdFilter),
    supabase.from("agent_resources").select("*").in("agent_id", agentIdFilter),
    supabase.from("cost_history").select("*").in("dept_id", deptIds.length > 0 ? deptIds : ["__none__"]),
  ]);

  // Group by agent_id / dept_id
  const agentSkillsByAgent = new Map<string, typeof allAgentSkills>();
  for (const row of allAgentSkills ?? []) {
    if (!agentSkillsByAgent.has(row.agent_id)) agentSkillsByAgent.set(row.agent_id, []);
    agentSkillsByAgent.get(row.agent_id)!.push(row);
  }

  const pluginsByAgent = new Map<string, typeof allPlugins>();
  for (const row of allPlugins ?? []) {
    if (!pluginsByAgent.has(row.agent_id)) pluginsByAgent.set(row.agent_id, []);
    pluginsByAgent.get(row.agent_id)!.push(row);
  }

  const mcpByAgent = new Map<string, typeof allMcpTools>();
  for (const row of allMcpTools ?? []) {
    if (!mcpByAgent.has(row.agent_id)) mcpByAgent.set(row.agent_id, []);
    mcpByAgent.get(row.agent_id)!.push(row);
  }

  const usageByAgent = new Map<string, typeof allUsageHistory>();
  for (const row of allUsageHistory ?? []) {
    if (!usageByAgent.has(row.agent_id)) usageByAgent.set(row.agent_id, []);
    usageByAgent.get(row.agent_id)!.push(row);
  }

  const resourcesByAgent = new Map<string, typeof allResources>();
  for (const row of allResources ?? []) {
    if (!resourcesByAgent.has(row.agent_id)) resourcesByAgent.set(row.agent_id, []);
    resourcesByAgent.get(row.agent_id)!.push(row);
  }

  const costByDept = new Map<string, typeof allCostHistory>();
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

  // Build response — pure in-memory, no more DB calls
  const depts: Department[] = (deptRows ?? []).map((dept) => {
    const deptAgents = agentsByDept.get(dept.id) ?? [];

    const agentList: Agent[] = deptAgents.map((agent) => {
      const agentSkillList: Skill[] = (agentSkillsByAgent.get(agent.id) ?? [])
        .map((as) => skillMap.get(as.skill_id))
        .filter((s): s is Skill => s !== undefined) as Skill[];

      const pluginList: Plugin[] = (pluginsByAgent.get(agent.id) ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        description: p.description,
        version: p.version,
        enabled: p.enabled,
      }));

      const mcpList: McpTool[] = (mcpByAgent.get(agent.id) ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        server: m.server,
        icon: m.icon,
        description: m.description,
        category: m.category as McpTool["category"],
      }));

      const usageList: DailyUsage[] = (usageByAgent.get(agent.id) ?? []).map((u) => ({
        date: u.date,
        tokens: u.tokens,
        cost: u.cost,
        requests: u.requests,
      }));

      const resourceList: AgentResource[] = (resourcesByAgent.get(agent.id) ?? []).map((r) => ({
        id: r.id,
        type: r.type as AgentResource["type"],
        name: r.name,
        icon: r.icon,
        description: r.description,
        url: r.url,
        accessLevel: r.access_level as AgentResource["accessLevel"],
        createdAt: r.created_at,
      }));

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        vendor: agent.vendor as Agent["vendor"],
        model: agent.model,
        status: agent.status as Agent["status"],
        monthlyCost: agent.monthly_cost,
        tokensUsed: agent.tokens_used,
        position: { x: agent.pos_x, y: agent.pos_y },
        skills: agentSkillList,
        plugins: pluginList,
        mcpTools: mcpList,
        resources: resourceList,
        usageHistory: usageList,
        lastActive: agent.last_active,
        createdAt: agent.created_at,
        humanId: agent.human_id ?? null,
        registeredBy: agent.registered_by ?? null,
        registeredByMember: agent.registered_by ? (memberMap.get(agent.registered_by) ?? null) : null,
      };
    });

    const costList: MonthlyCost[] = (costByDept.get(dept.id) ?? []).map((c) => ({
      month: c.month,
      amount: c.amount,
      byVendor: {
        anthropic: c.anthropic,
        openai: c.openai,
        google: c.google,
      },
    }));

    return {
      id: dept.id,
      name: dept.name,
      description: dept.description,
      parentId: dept.parent_id ?? null,
      budget: dept.budget,
      monthlySpend: dept.monthly_spend,
      layout: { x: dept.layout_x, y: dept.layout_y, width: dept.layout_w, height: dept.layout_h },
      primaryVendor: dept.primary_vendor as Department["primaryVendor"],
      agents: agentList,
      costHistory: costList,
    };
  });

  const result: Organization = {
    id: org.id,
    name: org.name,
    totalBudget: org.total_budget,
    departments: depts,
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const body = await request.json() as { name?: string; totalBudget?: number };

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.totalBudget !== undefined) updates.total_budget = body.totalBudget;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", orgId)
    .select("id, name, total_budget")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, name: data.name, totalBudget: data.total_budget });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  // Only the creator (first admin) should be able to delete — check role is admin
  const supabase = getSupabase();

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", orgId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
