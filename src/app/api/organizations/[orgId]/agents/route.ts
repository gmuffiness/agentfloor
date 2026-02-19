import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { searchParams } = new URL(request.url);
  const dept = searchParams.get("dept");
  const vendor = searchParams.get("vendor");
  const status = searchParams.get("status");

  const supabase = getSupabase();

  // Get departments belonging to this org
  const { data: orgDepts } = await supabase
    .from("departments")
    .select("id")
    .eq("org_id", orgId);

  const deptIds = (orgDepts ?? []).map((d) => d.id);
  if (deptIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = supabase.from("agents").select("*").in("dept_id", deptIds);
  if (dept) query = query.eq("dept_id", dept);
  if (vendor) query = query.eq("vendor", vendor);
  if (status) query = query.eq("status", status);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Join department name
  const { data: deptRows } = await supabase.from("departments").select("id, name").eq("org_id", orgId);
  const deptMap = new Map((deptRows ?? []).map((d) => [d.id, d.name]));

  const result = (rows ?? []).map((a) => ({
    ...a,
    departmentName: deptMap.get(a.dept_id) ?? "",
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const body = await request.json();
  const supabase = getSupabase();
  const id = `agent-${Date.now()}`;
  const now = new Date().toISOString();

  // Verify dept belongs to this org
  const { data: dept } = await supabase
    .from("departments")
    .select("id, org_id")
    .eq("id", body.deptId)
    .single();

  if (!dept || dept.org_id !== orgId) {
    return NextResponse.json({ error: "Department not found in this organization" }, { status: 400 });
  }

  const { error: agentError } = await supabase.from("agents").insert({
    id,
    dept_id: body.deptId,
    name: body.name,
    description: body.description ?? "",
    vendor: body.vendor ?? "anthropic",
    model: body.model ?? "",
    status: body.status ?? "idle",
    monthly_cost: body.monthlyCost ?? 0,
    tokens_used: body.tokensUsed ?? 0,
    pos_x: body.posX ?? Math.random() * 200 + 50,
    pos_y: body.posY ?? Math.random() * 150 + 80,
    last_active: now,
    created_at: now,
  });

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  // Link skills
  if (body.skillIds?.length) {
    const skillInserts = body.skillIds.map((skillId: string) => ({
      agent_id: id,
      skill_id: skillId,
    }));
    await supabase.from("agent_skills").insert(skillInserts);
  }

  // Create plugins
  if (body.plugins?.length) {
    const pluginInserts = body.plugins.map((p: { name: string; icon?: string; description?: string; version?: string; enabled?: boolean }) => ({
      id: `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agent_id: id,
      name: p.name,
      icon: p.icon ?? "",
      description: p.description ?? "",
      version: p.version ?? "1.0.0",
      enabled: p.enabled ?? true,
    }));
    await supabase.from("plugins").insert(pluginInserts);
  }

  // Create MCP tools
  if (body.mcpTools?.length) {
    const mcpInserts = body.mcpTools.map((m: { name: string; server?: string; icon?: string; description?: string; category?: string }) => ({
      id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agent_id: id,
      name: m.name,
      server: m.server ?? "",
      icon: m.icon ?? "",
      description: m.description ?? "",
      category: m.category ?? "api",
    }));
    await supabase.from("mcp_tools").insert(mcpInserts);
  }

  // Create resources
  if (body.resources?.length) {
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

  // Recalculate department monthly spend
  const { data: deptAgents } = await supabase
    .from("agents")
    .select("monthly_cost")
    .eq("dept_id", body.deptId);

  const totalSpend = (deptAgents ?? []).reduce((sum, a) => sum + a.monthly_cost, 0);
  await supabase
    .from("departments")
    .update({ monthly_spend: totalSpend })
    .eq("id", body.deptId);

  return NextResponse.json({ id, message: "Agent created" }, { status: 201 });
}
