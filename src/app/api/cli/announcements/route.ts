import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

/**
 * GET /api/cli/announcements?agentId=xxx
 * Returns unread announcements for the given agent.
 * No auth required (CLI endpoint).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  // Get agent with its department
  const { data: agent } = await supabase
    .from("agents")
    .select("id, dept_id")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Get the org_id via department
  const { data: dept } = await supabase
    .from("departments")
    .select("id, org_id")
    .eq("id", agent.dept_id)
    .single();

  if (!dept) {
    return NextResponse.json(
      { error: "Department not found" },
      { status: 404 },
    );
  }

  const orgId = dept.org_id;
  const now = new Date().toISOString();

  // Get all announcements for this org that haven't expired
  let query = supabase
    .from("announcements")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const { data: allAnnouncements, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get existing acks for this agent
  const { data: acks } = await supabase
    .from("announcement_acks")
    .select("announcement_id")
    .eq("agent_id", agentId);

  const ackedIds = new Set((acks ?? []).map((a) => a.announcement_id));

  // Filter: unread, not expired, and targeted at this agent
  const announcements = (allAnnouncements ?? []).filter((a) => {
    // Already acked
    if (ackedIds.has(a.id)) return false;
    // Expired
    if (a.expires_at && a.expires_at < now) return false;
    // Target filtering
    if (a.target_type === "all") return true;
    if (a.target_type === "department" && a.target_id === agent.dept_id)
      return true;
    if (a.target_type === "agent" && a.target_id === agentId) return true;
    return false;
  });

  const result = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    targetType: a.target_type,
    targetId: a.target_id,
    priority: a.priority,
    createdAt: a.created_at,
    expiresAt: a.expires_at,
  }));

  return NextResponse.json({ announcements: result });
}
