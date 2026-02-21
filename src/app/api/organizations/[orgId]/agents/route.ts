import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const { searchParams } = new URL(request.url);
  const dept = searchParams.get("dept");
  const vendor = searchParams.get("vendor");
  const status = searchParams.get("status");

  const supabase = getSupabase();

  // Fetch org visibility + departments in parallel (merged to save a roundtrip)
  const [{ data: orgCheck }, { data: orgDepts }] = await Promise.all([
    supabase.from("organizations").select("visibility").eq("id", orgId).single(),
    supabase.from("departments").select("id").eq("org_id", orgId),
  ]);

  // Auth check — skip for public orgs
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

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

  // Join department name and org_members data in parallel
  const [{ data: deptRows }, { data: memberRows }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("org_id", orgId),
    supabase.from("org_members").select("id, name, email").eq("org_id", orgId),
  ]);
  const deptMap = new Map((deptRows ?? []).map((d) => [d.id, d.name]));
  const memberMap = new Map((memberRows ?? []).map((m) => [m.id, m]));

  const result = (rows ?? []).map((a) => {
    const member = a.registered_by ? memberMap.get(a.registered_by) : null;
    const humanMember = a.human_id ? memberMap.get(a.human_id) : null;
    return {
      ...a,
      departmentName: deptMap.get(a.dept_id) ?? "",
      humanName: humanMember?.name ?? "",
      registeredByName: member?.name ?? "",
      registeredByEmail: member?.email ?? "",
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

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

  // Calculate position within department bounds
  let posX = body.posX;
  let posY = body.posY;
  if (posX == null || posY == null) {
    const { data: deptLayout } = await supabase
      .from("departments")
      .select("layout_x, layout_y, layout_w, layout_h")
      .eq("id", body.deptId)
      .single();

    const { count: existingCount } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("dept_id", body.deptId);

    if (deptLayout) {
      const PAD = 30;
      const AGENT_GAP = 50;
      const availW = deptLayout.layout_w - PAD * 2;
      const cols = Math.max(1, Math.floor(availW / AGENT_GAP));
      const idx = existingCount ?? 0;
      posX = deptLayout.layout_x + PAD + (idx % cols) * AGENT_GAP + AGENT_GAP / 2;
      posY = deptLayout.layout_y + PAD + 20 + Math.floor(idx / cols) * AGENT_GAP + AGENT_GAP / 2;
    } else {
      posX = Math.random() * 200 + 50;
      posY = Math.random() * 150 + 80;
    }
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
    pos_x: posX,
    pos_y: posY,
    human_id: body.humanId ?? null,
    runtime_type: body.runtimeType ?? "api",
    gateway_url: body.gatewayUrl ?? "",
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
