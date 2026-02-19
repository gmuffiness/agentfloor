import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgAdmin } from "@/lib/auth";

/**
 * POST /api/organizations/[orgId]/agents/[id]/push-request
 * Request the agent to run `agentfloor push` on next session start.
 * Admin only. Creates a special announcement targeting the specific agent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> },
) {
  const { orgId, id: agentId } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const supabase = getSupabase();

  // Verify agent exists and belongs to this org
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, dept_id")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: dept } = await supabase
    .from("departments")
    .select("org_id")
    .eq("id", agent.dept_id)
    .single();

  if (!dept || dept.org_id !== orgId) {
    return NextResponse.json({ error: "Agent not in this org" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const message = body.message ?? "Please run agentfloor push to sync your latest configuration.";

  const id = `ann-push-${Date.now()}`;
  const now = new Date().toISOString();

  const { error } = await supabase.from("announcements").insert({
    id,
    org_id: orgId,
    title: "[push-request]",
    content: message,
    target_type: "agent",
    target_id: agentId,
    priority: "urgent",
    created_by: adminCheck.user.id,
    created_at: now,
    expires_at: null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, agentId, message: "Push request sent" }, { status: 201 });
}
