import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Skills
  const { data: allSkills } = await supabase.from("skills").select("*");
  const skillMap = new Map((allSkills ?? []).map((s) => [s.id, s]));
  const { data: agentSkillRows } = await supabase
    .from("agent_skills")
    .select("skill_id")
    .eq("agent_id", id);
  const agentSkillList = (agentSkillRows ?? [])
    .map((as) => skillMap.get(as.skill_id))
    .filter(Boolean);

  // Plugins
  const { data: pluginRows } = await supabase
    .from("plugins")
    .select("*")
    .eq("agent_id", id);

  // MCP Tools
  const { data: mcpRows } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("agent_id", id);

  // Usage History
  const { data: usageRows } = await supabase
    .from("usage_history")
    .select("*")
    .eq("agent_id", id);

  // Resources
  const { data: resourceRows } = await supabase
    .from("agent_resources")
    .select("*")
    .eq("agent_id", id);

  return NextResponse.json({
    ...agent,
    position: { x: agent.pos_x, y: agent.pos_y },
    skills: agentSkillList,
    plugins: pluginRows ?? [],
    mcpTools: mcpRows ?? [],
    resources: (resourceRows ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      icon: r.icon,
      description: r.description,
      url: r.url,
      accessLevel: r.access_level,
      createdAt: r.created_at,
    })),
    usageHistory: (usageRows ?? []).map((u) => ({
      date: u.date,
      tokens: u.tokens,
      cost: u.cost,
      requests: u.requests,
    })),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();

  const { data: existing, error: findError } = await supabase
    .from("agents")
    .select("id, dept_id")
    .eq("id", id)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.vendor !== undefined) updates.vendor = body.vendor;
  if (body.model !== undefined) updates.model = body.model;
  if (body.status !== undefined) updates.status = body.status;
  if (body.monthlyCost !== undefined) updates.monthly_cost = body.monthlyCost;
  if (body.deptId !== undefined) updates.dept_id = body.deptId;

  if (Object.keys(updates).length > 0) {
    await supabase.from("agents").update(updates).eq("id", id);
  }

  // Update skills if provided
  if (body.skillIds) {
    await supabase.from("agent_skills").delete().eq("agent_id", id);
    if (body.skillIds.length > 0) {
      const skillInserts = body.skillIds.map((skillId: string) => ({
        agent_id: id,
        skill_id: skillId,
      }));
      await supabase.from("agent_skills").insert(skillInserts);
    }
  }

  // Update resources if provided
  if (body.resources) {
    await supabase.from("agent_resources").delete().eq("agent_id", id);
    if (body.resources.length > 0) {
      const now = new Date().toISOString();
      const resourceInserts = body.resources.map((r: { type: string; name: string; icon?: string; description?: string; url?: string; accessLevel?: string }) => ({
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agent_id: id,
        type: r.type,
        name: r.name,
        icon: r.icon ?? "",
        description: r.description ?? "",
        url: r.url ?? "",
        access_level: r.accessLevel ?? "read",
        created_at: now,
      }));
      await supabase.from("agent_resources").insert(resourceInserts);
    }
  }

  // Recalculate department spend if cost changed
  if (body.monthlyCost !== undefined || body.deptId !== undefined) {
    const deptId = body.deptId ?? existing.dept_id;
    const { data: deptAgents } = await supabase
      .from("agents")
      .select("monthly_cost")
      .eq("dept_id", deptId);

    const totalSpend = (deptAgents ?? []).reduce((sum, a) => sum + a.monthly_cost, 0);
    await supabase
      .from("departments")
      .update({ monthly_spend: totalSpend })
      .eq("id", deptId);
  }

  return NextResponse.json({ message: "Agent updated" });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: existing, error: findError } = await supabase
    .from("agents")
    .select("id, dept_id")
    .eq("id", id)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const deptId = existing.dept_id;
  await supabase.from("agents").delete().eq("id", id);

  // Recalculate department spend
  const { data: deptAgents } = await supabase
    .from("agents")
    .select("monthly_cost")
    .eq("dept_id", deptId);

  const totalSpend = (deptAgents ?? []).reduce((sum, a) => sum + a.monthly_cost, 0);
  await supabase
    .from("departments")
    .update({ monthly_spend: totalSpend })
    .eq("id", deptId);

  return NextResponse.json({ message: "Agent deleted" });
}
