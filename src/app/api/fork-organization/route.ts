import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireAuth } from "@/lib/auth";
import { generateInviteCode } from "@/lib/invite-code";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const body = await request.json();
  const { sourceOrgId, name } = body;

  if (!sourceOrgId) {
    return NextResponse.json({ error: "sourceOrgId is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Check that the source org exists and is public
  const { data: sourceOrg, error: sourceOrgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", sourceOrgId)
    .single();

  if (sourceOrgError || !sourceOrg) {
    return NextResponse.json({ error: "Source organization not found" }, { status: 404 });
  }

  if (sourceOrg.visibility !== "public") {
    return NextResponse.json({ error: "Source organization is not public" }, { status: 403 });
  }

  // Create the new (forked) organization
  const now = new Date().toISOString();
  const newOrgId = `org-${Date.now()}`;
  const inviteCode = generateInviteCode();
  const displayName = user.user_metadata?.full_name ?? user.email ?? "Unknown";
  const newOrgName = name ?? `${sourceOrg.name} (fork)`;

  const { error: orgError } = await supabase.from("organizations").insert({
    id: newOrgId,
    name: newOrgName,
    total_budget: sourceOrg.total_budget ?? 0,
    visibility: "private",
    invite_code: inviteCode,
    created_by: displayName,
    creator_user_id: user.id,
    forked_from: sourceOrgId,
    created_at: now,
  });

  if (orgError) {
    console.error("[fork-organization] Failed to create forked organization:", orgError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Add creator as admin member
  await supabase.from("org_members").insert({
    id: `member-${Date.now()}`,
    org_id: newOrgId,
    name: displayName,
    email: user.email ?? null,
    role: "admin",
    status: "active",
    user_id: user.id,
    joined_at: now,
  });

  // Fetch source departments
  const { data: sourceDepts } = await supabase
    .from("departments")
    .select("*")
    .eq("org_id", sourceOrgId);

  // Clone departments, handling parent_id hierarchy:
  // First pass: clone top-level departments (parent_id is null)
  // Second pass: clone child departments with mapped parent_ids
  const deptIdMap = new Map<string, string>(); // old id -> new id

  const allDepts = sourceDepts ?? [];

  // Sort: parents first (null parent_id), then children
  const sortedDepts = [
    ...allDepts.filter((d) => !d.parent_id),
    ...allDepts.filter((d) => !!d.parent_id),
  ];

  let deptCounter = 0;
  for (const dept of sortedDepts) {
    deptCounter++;
    const newDeptId = `dept-${Date.now() + deptCounter}`;
    deptIdMap.set(dept.id, newDeptId);

    const newParentId = dept.parent_id ? (deptIdMap.get(dept.parent_id) ?? null) : null;

    await supabase.from("departments").insert({
      id: newDeptId,
      org_id: newOrgId,
      parent_id: newParentId,
      name: dept.name,
      description: dept.description ?? "",
      budget: dept.budget ?? 0,
      monthly_spend: 0,
      primary_vendor: dept.primary_vendor ?? "anthropic",
      layout_x: dept.layout_x,
      layout_y: dept.layout_y,
      layout_w: dept.layout_w,
      layout_h: dept.layout_h,
      created_at: now,
    });
  }

  // Fetch source agents
  const sourceDeptIds = allDepts.map((d) => d.id);
  if (sourceDeptIds.length > 0) {
    const { data: sourceAgents } = await supabase
      .from("agents")
      .select("*")
      .in("dept_id", sourceDeptIds);

    const agents = sourceAgents ?? [];
    let agentCounter = 0;

    for (const agent of agents) {
      agentCounter++;
      const newAgentId = `agent-${Date.now() + agentCounter}`;
      const newDeptId = deptIdMap.get(agent.dept_id);

      if (!newDeptId) continue;

      await supabase.from("agents").insert({
        id: newAgentId,
        dept_id: newDeptId,
        name: agent.name,
        description: agent.description ?? "",
        vendor: agent.vendor ?? "anthropic",
        model: agent.model ?? "",
        status: "idle",
        monthly_cost: agent.monthly_cost ?? 0,
        tokens_used: 0,
        pos_x: agent.pos_x,
        pos_y: agent.pos_y,
        human_id: null,
        runtime_type: agent.runtime_type ?? "api",
        gateway_url: agent.gateway_url ?? "",
        last_active: now,
        created_at: now,
      });

      // Clone agent_skills (link to cloned agent; skill_id references global skills table — keep same)
      const { data: agentSkills } = await supabase
        .from("agent_skills")
        .select("skill_id")
        .eq("agent_id", agent.id);

      if (agentSkills && agentSkills.length > 0) {
        await supabase.from("agent_skills").insert(
          agentSkills.map((s) => ({ agent_id: newAgentId, skill_id: s.skill_id }))
        );
      }

      // Clone plugins
      const { data: plugins } = await supabase
        .from("plugins")
        .select("*")
        .eq("agent_id", agent.id);

      if (plugins && plugins.length > 0) {
        let pluginCounter = 0;
        await supabase.from("plugins").insert(
          plugins.map((p) => {
            pluginCounter++;
            return {
              id: `plugin-${Date.now() + agentCounter * 1000 + pluginCounter}`,
              agent_id: newAgentId,
              name: p.name,
              icon: p.icon ?? "",
              description: p.description ?? "",
              version: p.version ?? "1.0.0",
              enabled: p.enabled ?? true,
            };
          })
        );
      }

      // Clone MCP tools
      const { data: mcpTools } = await supabase
        .from("mcp_tools")
        .select("*")
        .eq("agent_id", agent.id);

      if (mcpTools && mcpTools.length > 0) {
        let mcpCounter = 0;
        await supabase.from("mcp_tools").insert(
          mcpTools.map((m) => {
            mcpCounter++;
            return {
              id: `mcp-${Date.now() + agentCounter * 1000 + mcpCounter}`,
              agent_id: newAgentId,
              name: m.name,
              server: m.server ?? "",
              icon: m.icon ?? "",
              description: m.description ?? "",
              category: m.category ?? "api",
            };
          })
        );
      }

      // Clone agent_resources
      const { data: resources } = await supabase
        .from("agent_resources")
        .select("*")
        .eq("agent_id", agent.id);

      if (resources && resources.length > 0) {
        let resCounter = 0;
        await supabase.from("agent_resources").insert(
          resources.map((r) => {
            resCounter++;
            return {
              id: `res-${Date.now() + agentCounter * 1000 + resCounter}`,
              agent_id: newAgentId,
              type: r.type,
              name: r.name,
              icon: r.icon ?? "",
              description: r.description ?? "",
              url: r.url ?? "",
              access_level: r.access_level ?? "read",
              created_at: now,
            };
          })
        );
      }
    }
  }

  return NextResponse.json(
    {
      id: newOrgId,
      name: newOrgName,
      inviteCode,
      forkedFrom: sourceOrgId,
    },
    { status: 201 }
  );
}
