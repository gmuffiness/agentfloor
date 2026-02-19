import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

/**
 * POST /api/cli/announcements/ack
 * Mark announcements as read for an agent.
 * No auth required (CLI endpoint).
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { agentId, announcementIds } = body;

  if (!agentId || !Array.isArray(announcementIds) || announcementIds.length === 0) {
    return NextResponse.json(
      { error: "agentId and announcementIds[] are required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const inserts = announcementIds.map((announcementId: string) => ({
    announcement_id: announcementId,
    agent_id: agentId,
    acked_at: now,
  }));

  const { error } = await supabase
    .from("announcement_acks")
    .upsert(inserts, { onConflict: "announcement_id,agent_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: announcementIds.length });
}
