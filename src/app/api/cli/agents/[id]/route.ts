import { NextRequest, NextResponse } from "next/server";
import { requireCliAuth } from "@/lib/cli-auth";
import { getSupabase } from "@/db/supabase";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verify the authenticated user is a member of the agent's organization.
 */
async function verifyAgentAccess(
  supabase: ReturnType<typeof getSupabase>,
  agentId: string,
  userId: string,
) {
  // Get agent and its department
  const { data: agent, error } = await supabase
    .from("agents")
    .select("*, dept_id")
    .eq("id", agentId)
    .single();

  if (error || !agent) {
    return { error: "Agent not found", status: 404, agent: null, orgId: null };
  }

  // Get department to find org
  const { data: dept } = await supabase
    .from("departments")
    .select("org_id")
    .eq("id", agent.dept_id)
    .single();

  if (!dept) {
    return { error: "Department not found", status: 404, agent: null, orgId: null };
  }

  // Verify membership
  const { data: member } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", dept.org_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    return { error: "Not a member of this organization", status: 403, agent: null, orgId: null };
  }

  return { error: null, status: 200, agent, orgId: dept.org_id };
}

/**
 * GET /api/cli/agents/[id]
 * Get agent details including skills, MCP tools, context, and resources.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireCliAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const supabase = getSupabase();

  const access = await verifyAgentAccess(supabase, id, auth.userId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const agent = access.agent;

  // Fetch related data in parallel
  const [skillsRes, mcpRes, contextRes, resourcesRes, deptRes] = await Promise.all([
    supabase
      .from("agent_skills")
      .select("skill_id, skills(id, name, category)")
      .eq("agent_id", id),
    supabase.from("mcp_tools").select("*").eq("agent_id", id),
    supabase.from("agent_context").select("*").eq("agent_id", id),
    supabase.from("agent_resources").select("*").eq("agent_id", id),
    supabase.from("departments").select("name, org_id").eq("id", agent.dept_id).single(),
  ]);

  const skills = (skillsRes.data ?? []).map((s: Record<string, unknown>) => {
    const skill = s.skills as Record<string, unknown> | null;
    return {
      id: skill?.id ?? s.skill_id,
      name: skill?.name ?? "Unknown",
      category: skill?.category ?? "",
    };
  });

  return NextResponse.json({
    id: agent.id,
    name: agent.name,
    vendor: agent.vendor,
    model: agent.model,
    status: agent.status,
    description: agent.description,
    departmentName: deptRes.data?.name ?? "Unknown",
    orgId: deptRes.data?.org_id ?? access.orgId,
    lastActive: agent.last_active,
    createdAt: agent.created_at,
    monthlyCost: agent.monthly_cost,
    tokensUsed: agent.tokens_used,
    runtimeType: agent.runtime_type,
    skills,
    mcpTools: (mcpRes.data ?? []).map((m: Record<string, unknown>) => ({
      id: m.id,
      name: m.name,
      server: m.server,
      category: m.category,
    })),
    context: (contextRes.data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      type: c.type,
      content: c.content,
      sourceFile: c.source_file,
    })),
    resources: (resourcesRes.data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      url: r.url,
      accessLevel: r.access_level,
    })),
  });
}

/**
 * PATCH /api/cli/agents/[id]
 * Update agent properties.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireCliAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const supabase = getSupabase();

  const access = await verifyAgentAccess(supabase, id, auth.userId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const allowedFields: Record<string, string> = {
    name: "name",
    description: "description",
    vendor: "vendor",
    model: "model",
    status: "status",
  };

  const updates: Record<string, unknown> = {};
  for (const [bodyKey, dbKey] of Object.entries(allowedFields)) {
    if (body[bodyKey] !== undefined) {
      updates[dbKey] = body[bodyKey];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("agents")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    console.error("[cli/agents] Failed to update agent:", updateError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id, updated: true, message: "Agent updated successfully" });
}

/**
 * DELETE /api/cli/agents/[id]
 * Delete an agent and update department spend.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireCliAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const supabase = getSupabase();

  const access = await verifyAgentAccess(supabase, id, auth.userId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const agent = access.agent;
  const deptId = agent.dept_id;

  // Delete related data first
  await Promise.all([
    supabase.from("agent_skills").delete().eq("agent_id", id),
    supabase.from("mcp_tools").delete().eq("agent_id", id),
    supabase.from("agent_context").delete().eq("agent_id", id),
    supabase.from("agent_resources").delete().eq("agent_id", id),
  ]);

  // Delete the agent
  const { error: deleteError } = await supabase
    .from("agents")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[cli/agents] Failed to delete agent:", deleteError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // Recalculate department spend
  const { data: remainingAgents } = await supabase
    .from("agents")
    .select("monthly_cost")
    .eq("dept_id", deptId);

  const totalSpend = (remainingAgents ?? []).reduce(
    (sum: number, a: { monthly_cost: number }) => sum + (a.monthly_cost ?? 0),
    0,
  );

  await supabase
    .from("departments")
    .update({ monthly_spend: totalSpend })
    .eq("id", deptId);

  return NextResponse.json({
    id,
    deleted: true,
    message: `Agent "${agent.name}" deleted successfully`,
  });
}
