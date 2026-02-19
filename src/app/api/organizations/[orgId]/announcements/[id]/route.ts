import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember, requireOrgAdmin } from "@/lib/auth";

/**
 * GET /api/organizations/[orgId]/announcements/[id]
 * Get announcement detail with ack list.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> },
) {
  const { orgId, id } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const supabase = getSupabase();

  const { data: announcement, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !announcement) {
    return NextResponse.json(
      { error: "Announcement not found" },
      { status: 404 },
    );
  }

  // Get ack details with agent names
  const { data: acks } = await supabase
    .from("announcement_acks")
    .select("agent_id, acked_at")
    .eq("announcement_id", id);

  const agentIds = (acks ?? []).map((a) => a.agent_id);
  let agentNames: Record<string, string> = {};

  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", agentIds);

    for (const a of agents ?? []) {
      agentNames[a.id] = a.name;
    }
  }

  const ackList = (acks ?? []).map((a) => ({
    agentId: a.agent_id,
    agentName: agentNames[a.agent_id] ?? "Unknown",
    ackedAt: a.acked_at,
  }));

  return NextResponse.json({
    id: announcement.id,
    orgId: announcement.org_id,
    title: announcement.title,
    content: announcement.content,
    targetType: announcement.target_type,
    targetId: announcement.target_id,
    priority: announcement.priority,
    createdBy: announcement.created_by,
    createdAt: announcement.created_at,
    expiresAt: announcement.expires_at,
    acks: ackList,
  });
}

/**
 * DELETE /api/organizations/[orgId]/announcements/[id]
 * Delete an announcement (admin only).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> },
) {
  const { orgId, id } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const supabase = getSupabase();

  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Announcement deleted" });
}
