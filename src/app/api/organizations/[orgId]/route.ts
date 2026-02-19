import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import type { Organization, Department, Agent, Skill, Plugin, McpTool, MonthlyCost, DailyUsage } from "@/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = getSupabase();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: deptRows } = await supabase
    .from("departments")
    .select("*")
    .eq("org_id", org.id);

  const { data: allSkills } = await supabase.from("skills").select("*");
  const skillMap = new Map((allSkills ?? []).map((s) => [s.id, s]));

  const depts: Department[] = [];

  for (const dept of deptRows ?? []) {
    const { data: agentRows } = await supabase
      .from("agents")
      .select("*")
      .eq("dept_id", dept.id);

    const agentList: Agent[] = [];

    for (const agent of agentRows ?? []) {
      // Skills
      const { data: agentSkillRows } = await supabase
        .from("agent_skills")
        .select("skill_id")
        .eq("agent_id", agent.id);

      const agentSkillList: Skill[] = (agentSkillRows ?? [])
        .map((as) => skillMap.get(as.skill_id))
        .filter((s): s is Skill => s !== undefined) as Skill[];

      // Plugins
      const { data: pluginRows } = await supabase
        .from("plugins")
        .select("*")
        .eq("agent_id", agent.id);

      const pluginList: Plugin[] = (pluginRows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        description: p.description,
        version: p.version,
        enabled: p.enabled,
      }));

      // MCP Tools
      const { data: mcpRows } = await supabase
        .from("mcp_tools")
        .select("*")
        .eq("agent_id", agent.id);

      const mcpList: McpTool[] = (mcpRows ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        server: m.server,
        icon: m.icon,
        description: m.description,
        category: m.category as McpTool["category"],
      }));

      // Usage History
      const { data: usageRows } = await supabase
        .from("usage_history")
        .select("*")
        .eq("agent_id", agent.id);

      const usageList: DailyUsage[] = (usageRows ?? []).map((u) => ({
        date: u.date,
        tokens: u.tokens,
        cost: u.cost,
        requests: u.requests,
      }));

      agentList.push({
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
        resources: [],
        usageHistory: usageList,
        lastActive: agent.last_active,
        createdAt: agent.created_at,
      });
    }

    // Cost History
    const { data: costRows } = await supabase
      .from("cost_history")
      .select("*")
      .eq("dept_id", dept.id);

    const costList: MonthlyCost[] = (costRows ?? []).map((c) => ({
      month: c.month,
      amount: c.amount,
      byVendor: {
        anthropic: c.anthropic,
        openai: c.openai,
        google: c.google,
      },
    }));

    depts.push({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      budget: dept.budget,
      monthlySpend: dept.monthly_spend,
      layout: { x: dept.layout_x, y: dept.layout_y, width: dept.layout_w, height: dept.layout_h },
      primaryVendor: dept.primary_vendor as Department["primaryVendor"],
      agents: agentList,
      costHistory: costList,
    });
  }

  const result: Organization = {
    id: org.id,
    name: org.name,
    totalBudget: org.total_budget,
    departments: depts,
  };

  return NextResponse.json(result);
}
