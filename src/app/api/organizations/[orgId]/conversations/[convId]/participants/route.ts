import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

async function checkPublicOrg(supabase: ReturnType<typeof getSupabase>, orgId: string): Promise<NextResponse | null> {
  const { data: orgCheck } = await supabase.from("organizations").select("visibility").eq("id", orgId).single();
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }
  return null;
}

// Add agent(s) to conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; convId: string }> }
) {
  const { orgId, convId } = await params;

  const supabase = getSupabase();
  const authErr = await checkPublicOrg(supabase, orgId);
  if (authErr) return authErr;

  const body = await request.json();
  const { agentIds } = body as { agentIds: string[] };

  if (!agentIds || agentIds.length === 0) {
    return NextResponse.json({ error: "agentIds required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const rows = agentIds.map((agentId) => ({
    id: `cp-${convId}-${agentId}-${Date.now()}`,
    conversation_id: convId,
    agent_id: agentId,
    joined_at: now,
  }));

  const { error } = await supabase
    .from("conversation_participants")
    .upsert(rows, { onConflict: "conversation_id,agent_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// Remove agent from conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; convId: string }> }
) {
  const { orgId, convId } = await params;

  const supabase = getSupabase();
  const authErr = await checkPublicOrg(supabase, orgId);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId query param required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", convId)
    .eq("agent_id", agentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
