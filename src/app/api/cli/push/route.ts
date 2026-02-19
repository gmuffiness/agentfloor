import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

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
  } = body;

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

  // If agentId provided, try to update
  if (agentId) {
    const { data: existing } = await supabase
      .from("agents")
      .select("id, dept_id")
      .eq("id", agentId)
      .single();

    if (existing) {
      // Update agent fields
      const { error: updateError } = await supabase
        .from("agents")
        .update({
          name: agentName,
          vendor,
          model,
          description: description || `Pushed via CLI at ${new Date().toISOString()}`,
          last_active: new Date().toISOString(),
        })
        .eq("id", agentId);

      if (updateError) {
        console.error("Agent update failed:", updateError);
        return NextResponse.json(
          { error: `Failed to update agent: ${updateError.message}` },
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

      return NextResponse.json({
        id: agentId,
        updated: true,
        message: `Agent "${agentName}" updated successfully`,
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
  });

  if (insertError) {
    console.error("Agent insert failed:", insertError);
    return NextResponse.json(
      { error: `Failed to create agent: ${insertError.message}` },
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

  return NextResponse.json(
    {
      id: newAgentId,
      departmentId: deptId,
      updated: false,
      message: `Agent "${agentName}" registered successfully`,
    },
    { status: 201 },
  );
}
