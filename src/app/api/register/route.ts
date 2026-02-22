import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireCliAuth } from "@/lib/cli-auth";

export async function POST(request: NextRequest) {
  const authResult = await requireCliAuth(request);
  if (authResult instanceof NextResponse) return authResult;

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
    const GRID_COLS = 3;
    const DEPT_W = 300;
    const DEPT_H = 240;
    const GAP_X = 50;
    const GAP_Y = 80;
    const START_X = 50;
    const START_Y = 50;

    const { data: existing } = await supabase
      .from("departments")
      .select("id")
      .eq("org_id", resolvedOrgId);
    const count = (existing ?? []).length;
    const col = count % GRID_COLS;
    const row = Math.floor(count / GRID_COLS);

    const { error: deptError } = await supabase.from("departments").insert({
      id: deptId,
      org_id: resolvedOrgId,
      name: departmentName,
      description: "",
      budget: 0,
      monthly_spend: 0,
      primary_vendor: vendor,
      layout_x: START_X + col * (DEPT_W + GAP_X),
      layout_y: START_Y + row * (DEPT_H + GAP_Y),
      layout_w: DEPT_W,
      layout_h: DEPT_H,
      created_at: new Date().toISOString(),
    });

    if (deptError) {
      console.error("[register] Failed to create department:", deptError);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

  // Create agent — position within department bounds
  const agentId = `agent-${Date.now()}`;
  const now = new Date().toISOString();

  const { data: deptLayout } = await supabase
    .from("departments")
    .select("layout_x, layout_y, layout_w, layout_h")
    .eq("id", deptId)
    .single();

  const { count: existingCount } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("dept_id", deptId);

  let posX: number;
  let posY: number;
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
    pos_x: posX,
    pos_y: posY,
    last_active: now,
    created_at: now,
  });

  if (agentError) {
    console.error("[register] Failed to create agent:", agentError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

  // Save agent context (CLAUDE.md etc.)
  if (body.context?.length) {
    const contextInserts = body.context.map((ctx: { type: string; content: string; sourceFile?: string }) => ({
      id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agent_id: agentId,
      type: ctx.type ?? "custom",
      content: ctx.content,
      source_file: ctx.sourceFile ?? null,
      updated_at: now,
    }));
    await supabase.from("agent_context").insert(contextInserts);
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
