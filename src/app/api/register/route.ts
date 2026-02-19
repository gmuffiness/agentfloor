import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = getSupabase();

  const { agentName, vendor, model, departmentId, departmentName, orgId } = body;

  if (!agentName || !vendor || !model) {
    return NextResponse.json(
      { error: "agentName, vendor, and model are required" },
      { status: 400 }
    );
  }

  // Resolve organization
  let resolvedOrgId = orgId;
  if (!resolvedOrgId) {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id")
      .limit(1);
    resolvedOrgId = orgs?.[0]?.id;
  }

  if (!resolvedOrgId) {
    return NextResponse.json(
      { error: "No organization found. Create one first via POST /api/organizations" },
      { status: 400 }
    );
  }

  // Resolve or create department
  let deptId = departmentId;
  if (!deptId && departmentName) {
    deptId = `dept-${Date.now()}`;
    const { data: existing } = await supabase
      .from("departments")
      .select("layout_y, layout_h")
      .eq("org_id", resolvedOrgId);
    const maxY = (existing ?? []).reduce((max, d) => Math.max(max, d.layout_y + d.layout_h), 0);

    const { error: deptError } = await supabase.from("departments").insert({
      id: deptId,
      org_id: resolvedOrgId,
      name: departmentName,
      description: "",
      budget: 0,
      monthly_spend: 0,
      primary_vendor: vendor,
      layout_x: 50,
      layout_y: maxY + 50,
      layout_w: 300,
      layout_h: 240,
      created_at: new Date().toISOString(),
    });

    if (deptError) {
      return NextResponse.json({ error: deptError.message }, { status: 500 });
    }
  }

  if (!deptId) {
    // Default to first department
    const { data: deptRows } = await supabase
      .from("departments")
      .select("id")
      .eq("org_id", resolvedOrgId)
      .limit(1);

    if (!deptRows?.length) {
      return NextResponse.json(
        { error: "No departments exist. Provide departmentName to create one." },
        { status: 400 }
      );
    }
    deptId = deptRows[0].id;
  }

  // Create agent
  const agentId = `agent-${Date.now()}`;
  const now = new Date().toISOString();

  const { error: agentError } = await supabase.from("agents").insert({
    id: agentId,
    dept_id: deptId,
    name: agentName,
    description: body.description ?? `Registered via CLI at ${now}`,
    vendor,
    model,
    status: "active",
    monthly_cost: body.monthlyCost ?? 0,
    tokens_used: 0,
    pos_x: Math.random() * 200 + 50,
    pos_y: Math.random() * 150 + 80,
    last_active: now,
    created_at: now,
  });

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  // Link skills by name
  if (body.skills?.length) {
    const { data: allSkills } = await supabase.from("skills").select("id, name");
    const skillNameMap = new Map(
      (allSkills ?? []).map((s) => [s.name.toLowerCase(), s.id])
    );
    const skillInserts = body.skills
      .map((skillName: string) => skillNameMap.get(skillName.toLowerCase()))
      .filter(Boolean)
      .map((skillId: string) => ({ agent_id: agentId, skill_id: skillId }));

    if (skillInserts.length > 0) {
      await supabase.from("agent_skills").insert(skillInserts);
    }
  }

  // Create plugins
  if (body.plugins?.length) {
    const pluginInserts = body.plugins.map((p: string | { name: string; icon?: string; description?: string; version?: string }) => {
      const name = typeof p === "string" ? p : p.name;
      return {
        id: `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agent_id: agentId,
        name,
        icon: typeof p === "object" ? p.icon ?? "" : "",
        description: typeof p === "object" ? p.description ?? "" : "",
        version: typeof p === "object" ? p.version ?? "1.0.0" : "1.0.0",
        enabled: true,
      };
    });
    await supabase.from("plugins").insert(pluginInserts);
  }

  // Create MCP tools
  if (body.mcpTools?.length) {
    const mcpInserts = body.mcpTools.map((m: string | { name: string; server?: string; icon?: string; description?: string; category?: string }) => {
      const name = typeof m === "string" ? m : m.name;
      return {
        id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agent_id: agentId,
        name,
        server: typeof m === "object" ? m.server ?? "" : "",
        icon: typeof m === "object" ? m.icon ?? "" : "",
        description: typeof m === "object" ? m.description ?? "" : "",
        category: typeof m === "object" ? m.category ?? "api" : "api",
      };
    });
    await supabase.from("mcp_tools").insert(mcpInserts);
  }

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

  return NextResponse.json({
    id: agentId,
    departmentId: deptId,
    organizationId: resolvedOrgId,
    message: `Agent "${agentName}" registered successfully`,
  }, { status: 201 });
}
