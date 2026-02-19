import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  const supabase = getSupabase();

  let query = supabase
    .from("conversations")
    .select("id, org_id, agent_id, title, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get last message preview for each conversation
  const conversations = await Promise.all(
    (data ?? []).map(async (conv) => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("content, role")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastMsg = msgs?.[0];
      return {
        id: conv.id,
        orgId: conv.org_id,
        agentId: conv.agent_id,
        title: conv.title,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        lastMessage: lastMsg ? `${lastMsg.role === "user" ? "You" : "AI"}: ${lastMsg.content.slice(0, 80)}` : undefined,
      };
    })
  );

  return NextResponse.json(conversations);
}
