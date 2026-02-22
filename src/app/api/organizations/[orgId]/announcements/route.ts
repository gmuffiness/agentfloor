import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember, requireOrgAdmin } from "@/lib/auth";

/**
 * GET /api/organizations/[orgId]/announcements
 * List announcements for the org (with ack counts).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const supabaseCheck = getSupabase();
  const { data: orgCheck } = await supabaseCheck.from("organizations").select("visibility").eq("id", orgId).single();
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[organizations/announcements] Failed to fetch announcements:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Get ack counts per announcement
  const announcementIds = (rows ?? []).map((r) => r.id);
  let ackCounts: Record<string, number> = {};

  if (announcementIds.length > 0) {
    const { data: acks } = await supabase
      .from("announcement_acks")
      .select("announcement_id")
      .in("announcement_id", announcementIds);

    for (const ack of acks ?? []) {
      ackCounts[ack.announcement_id] =
        (ackCounts[ack.announcement_id] ?? 0) + 1;
    }
  }

  // Get total agent count per target for context
  const { data: orgDepts } = await supabase
    .from("departments")
    .select("id")
    .eq("org_id", orgId);
  const deptIds = (orgDepts ?? []).map((d) => d.id);

  let totalAgentCount = 0;
  const deptAgentCounts: Record<string, number> = {};

  if (deptIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, dept_id")
      .in("dept_id", deptIds);

    totalAgentCount = (agents ?? []).length;
    for (const a of agents ?? []) {
      deptAgentCounts[a.dept_id] = (deptAgentCounts[a.dept_id] ?? 0) + 1;
    }
  }

  const result = (rows ?? []).map((a) => {
    let targetCount = totalAgentCount;
    if (a.target_type === "department" && a.target_id) {
      targetCount = deptAgentCounts[a.target_id] ?? 0;
    } else if (a.target_type === "agent") {
      targetCount = 1;
    }

    return {
      id: a.id,
      orgId: a.org_id,
      title: a.title,
      content: a.content,
      targetType: a.target_type,
      targetId: a.target_id,
      priority: a.priority,
      createdBy: a.created_by,
      createdAt: a.created_at,
      expiresAt: a.expires_at,
      ackCount: ackCounts[a.id] ?? 0,
      targetCount,
    };
  });

  return NextResponse.json(result);
}

/**
 * POST /api/organizations/[orgId]/announcements
 * Create a new announcement (admin only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const body = await request.json();
  const { title, content, targetType, targetId, priority, expiresAt } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();
  const id = `ann-${Date.now()}`;
  const now = new Date().toISOString();

  const { error } = await supabase.from("announcements").insert({
    id,
    org_id: orgId,
    title,
    content,
    target_type: targetType ?? "all",
    target_id: targetId ?? null,
    priority: priority ?? "normal",
    created_by: adminCheck.user.id,
    created_at: now,
    expires_at: expiresAt ?? null,
  });

  if (error) {
    console.error("[organizations/announcements] Failed to create announcement:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ id, message: "Announcement created" }, { status: 201 });
}
