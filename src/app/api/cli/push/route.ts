import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabase } from "@/db/supabase";
import { requireCliAuth } from "@/lib/cli-auth";

/**
 * Upsert auto-detected subscriptions for a member.
 * Skips if subscription already exists (same member + service name).
 */
async function upsertDetectedSubscriptions(
  supabase: ReturnType<typeof getSupabase>,
  memberId: string,
  orgId: string,
  subscriptions: Array<{ name: string; detectionSource?: string }>,
) {
  const now = new Date().toISOString();
  for (const sub of subscriptions) {
    const { data: existing } = await supabase
      .from("member_subscriptions")
      .select("id")
      .eq("member_id", memberId)
      .eq("service_name", sub.name)
      .eq("org_id", orgId)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("member_subscriptions").insert({
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      member_id: memberId,
      org_id: orgId,
      service_name: sub.name,
      service_category: "other",
      cost_type: "subscription",
      monthly_amount: 0,
      currency: "USD",
      billing_cycle: "monthly",
      auto_detected: true,
      detection_source: sub.detectionSource || "cli_push",
      is_active: true,
      notes: "",
      created_at: now,
      updated_at: now,
    });
  }
}

/**
 * Upsert skill names into the skills table and link them to an agent.
 * - For each skill name, find existing or create new skill row.
 * - Replace all agent_skills links for the agent.
 */
async function upsertSkillsForAgent(
  supabase: ReturnType<typeof getSupabase>,
  agentId: string,
  skillNames: string[],
) {
  const skillIds: string[] = [];

  for (const name of skillNames) {
    // Try to find existing skill by name
    const { data: existing } = await supabase
      .from("skills")
      .select("id")
      .eq("name", name)
      .limit(1);

    if (existing?.length) {
      skillIds.push(existing[0].id);
    } else {
      // Create new skill
      const newId = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await supabase.from("skills").insert({
        id: newId,
        name,
        icon: "",
        description: "",
        category: "generation",
      });
      skillIds.push(newId);
    }
  }

  // Replace agent_skills links
  await supabase.from("agent_skills").delete().eq("agent_id", agentId);
  if (skillIds.length > 0) {
    const inserts = skillIds.map((skillId) => ({
      agent_id: agentId,
      skill_id: skillId,
    }));
    await supabase.from("agent_skills").insert(inserts);
  }
}

/**
 * Upsert git repo URL into agent_resources table.
 * Replaces existing git_repo resource for the agent if any.
 */
async function upsertRepoUrl(
  supabase: ReturnType<typeof getSupabase>,
  agentId: string,
  repoUrl: string,
) {
  // Delete existing git_repo resources for this agent
  await supabase
    .from("agent_resources")
    .delete()
    .eq("agent_id", agentId)
    .eq("type", "git_repo");

  // Derive a short name from the URL
  const name = repoUrl.replace(/\.git$/, "").split("/").slice(-2).join("/");

  await supabase.from("agent_resources").insert({
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agent_id: agentId,
    type: "git_repo",
    name,
    icon: "",
    description: "",
    url: repoUrl,
    access_level: "write",
    created_at: new Date().toISOString(),
  });
}

/**
 * POST /api/cli/push
 * CLI-only agent push endpoint — no Supabase Auth required.
 * Handles both create and update based on whether agentId is provided.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireCliAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const supabase = getSupabase();

  const {
    agentId,
    agentName,
    vendor,
    model,
    orgId,
    departmentName,
    description,
    mcpTools,
    skills,
    context,
    memberId,
    repoUrl,
    runtimeType,
    gatewayUrl,
    detectedSubscriptions,
  } = body;

  // Verify memberId ownership if provided
  if (memberId && authResult.memberId !== memberId) {
    return NextResponse.json(
      { error: "Forbidden: memberId does not match authenticated user" },
      { status: 403 },
    );
  }

  if (!agentName || !vendor || !model || !orgId) {
    return NextResponse.json(
      { error: "agentName, vendor, model, and orgId are required" },
      { status: 400 },
    );
  }

  // Verify org exists
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  // Verify authenticated user is a member of the org
  const { data: orgMember } = await supabase
    .from("org_members")
    .select("id")
    .eq("id", authResult.memberId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!orgMember) {
    return NextResponse.json(
      { error: "Forbidden: you are not a member of this organization" },
      { status: 403 },
    );
  }

  // If agentId provided, try to update
  if (agentId) {
    const { data: existing } = await supabase
      .from("agents")
      .select("id, dept_id")
      .eq("id", agentId)
      .single();

    if (existing) {
      // Check if agent needs to move to a different org's department
      const { data: currentDept } = await supabase
        .from("departments")
        .select("org_id")
        .eq("id", existing.dept_id)
        .single();

      let newDeptId = existing.dept_id;
      if (currentDept && currentDept.org_id !== orgId) {
        // Agent's current department belongs to a different org — reassign
        const { data: targetDepts } = await supabase
          .from("departments")
          .select("id")
          .eq("org_id", orgId)
          .limit(1);

        if (targetDepts?.length) {
          newDeptId = targetDepts[0].id;
        } else {
          // Create default department in target org
          newDeptId = `dept-${Date.now()}`;
          await supabase.from("departments").insert({
            id: newDeptId,
            org_id: orgId,
            name: departmentName || "Engineering",
            description: "",
            budget: 0,
            monthly_spend: 0,
            primary_vendor: vendor,
            layout_x: 50,
            layout_y: 50,
            layout_w: 300,
            layout_h: 240,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Generate poll_token for openclaw agents without one
      let pollToken: string | undefined;
      if (runtimeType === "openclaw") {
        const { data: currentAgent } = await supabase
          .from("agents")
          .select("poll_token")
          .eq("id", agentId)
          .single();
        if (!currentAgent?.poll_token) {
          pollToken = randomBytes(32).toString("hex");
        } else {
          pollToken = currentAgent.poll_token;
        }
      }

      // Update agent fields
      const { error: updateError } = await supabase
        .from("agents")
        .update({
          name: agentName,
          vendor,
          model,
          dept_id: newDeptId,
          description: description || `Pushed via CLI at ${new Date().toISOString()}`,
          last_active: new Date().toISOString(),
          ...(runtimeType !== undefined && { runtime_type: runtimeType }),
          ...(gatewayUrl !== undefined && { gateway_url: gatewayUrl }),
          ...(pollToken !== undefined && { poll_token: pollToken }),
        })
        .eq("id", agentId);

      if (updateError) {
        console.error("[cli/push] Agent update failed:", updateError);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }

      // Update MCP tools: delete old, insert new
      if (mcpTools) {
        await supabase.from("mcp_tools").delete().eq("agent_id", agentId);
        if (mcpTools.length > 0) {
          const mcpInserts = mcpTools.map(
            (m: string | { name: string; server?: string }) => {
              const name = typeof m === "string" ? m : m.name;
              return {
                id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                agent_id: agentId,
                name,
                server: typeof m === "object" ? (m.server ?? "") : "",
                icon: "",
                description: "",
                category: "api",
              };
            },
          );
          await supabase.from("mcp_tools").insert(mcpInserts);
        }
      }

      // Update context: delete old, insert new
      if (context) {
        await supabase.from("agent_context").delete().eq("agent_id", agentId);
        if (context.length > 0) {
          const now = new Date().toISOString();
          const contextInserts = context.map(
            (ctx: { type: string; content: string; sourceFile?: string }) => ({
              id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              agent_id: agentId,
              type: ctx.type ?? "custom",
              content: ctx.content,
              source_file: ctx.sourceFile ?? null,
              updated_at: now,
            }),
          );
          await supabase.from("agent_context").insert(contextInserts);
        }
      }

      // Update skills
      if (skills?.length) {
        await upsertSkillsForAgent(supabase, agentId, skills);
      }

      // Update git repo URL
      if (repoUrl) {
        await upsertRepoUrl(supabase, agentId, repoUrl);
      }

      // Upsert detected subscriptions
      if (detectedSubscriptions?.length && memberId) {
        await upsertDetectedSubscriptions(supabase, memberId, orgId, detectedSubscriptions);
      }

      return NextResponse.json({
        id: agentId,
        updated: true,
        message: `Agent "${agentName}" updated successfully`,
        ...(pollToken && { pollToken }),
      });
    }

    // Agent not found — fall through to create
  }

  // Create new agent — resolve department
  let deptId: string | undefined;

  // Try to find existing department
  const { data: deptRows } = await supabase
    .from("departments")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);

  if (deptRows?.length) {
    deptId = deptRows[0].id;
  } else {
    // Create default department
    deptId = `dept-${Date.now()}`;
    await supabase.from("departments").insert({
      id: deptId,
      org_id: orgId,
      name: departmentName || "Engineering",
      description: "",
      budget: 0,
      monthly_spend: 0,
      primary_vendor: vendor,
      layout_x: 50,
      layout_y: 50,
      layout_w: 300,
      layout_h: 240,
      created_at: new Date().toISOString(),
    });
  }

  const newAgentId = `agent-${Date.now()}`;
  const now = new Date().toISOString();

  // Generate poll_token for openclaw agents
  const newPollToken = runtimeType === "openclaw" ? randomBytes(32).toString("hex") : undefined;

  const { error: insertError } = await supabase.from("agents").insert({
    id: newAgentId,
    dept_id: deptId,
    name: agentName,
    description: description || `Pushed via CLI at ${now}`,
    vendor,
    model,
    status: "active",
    monthly_cost: 0,
    tokens_used: 0,
    pos_x: Math.random() * 200 + 50,
    pos_y: Math.random() * 150 + 80,
    last_active: now,
    created_at: now,
    registered_by: memberId || null,
    runtime_type: runtimeType || "api",
    gateway_url: gatewayUrl || "",
    ...(newPollToken && { poll_token: newPollToken }),
  });

  if (insertError) {
    console.error("[cli/push] Agent insert failed:", insertError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // Create MCP tools
  if (mcpTools?.length) {
    const mcpInserts = mcpTools.map(
      (m: string | { name: string; server?: string }) => {
        const name = typeof m === "string" ? m : m.name;
        return {
          id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agent_id: newAgentId,
          name,
          server: typeof m === "object" ? (m.server ?? "") : "",
          icon: "",
          description: "",
          category: "api",
        };
      },
    );
    await supabase.from("mcp_tools").insert(mcpInserts);
  }

  // Save context
  if (context?.length) {
    const contextInserts = context.map(
      (ctx: { type: string; content: string; sourceFile?: string }) => ({
        id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agent_id: newAgentId,
        type: ctx.type ?? "custom",
        content: ctx.content,
        source_file: ctx.sourceFile ?? null,
        updated_at: now,
      }),
    );
    await supabase.from("agent_context").insert(contextInserts);
  }

  // Link skills
  if (skills?.length) {
    await upsertSkillsForAgent(supabase, newAgentId, skills);
  }

  // Save git repo URL
  if (repoUrl) {
    await upsertRepoUrl(supabase, newAgentId, repoUrl);
  }

  // Upsert detected subscriptions
  if (detectedSubscriptions?.length && memberId) {
    await upsertDetectedSubscriptions(supabase, memberId, orgId, detectedSubscriptions);
  }

  return NextResponse.json(
    {
      id: newAgentId,
      departmentId: deptId,
      updated: false,
      message: `Agent "${agentName}" registered successfully`,
      ...(newPollToken && { pollToken: newPollToken }),
    },
    { status: 201 },
  );
}
