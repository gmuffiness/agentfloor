import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const supabase = getSupabase();

  // Auth check — skip for public orgs
  const { data: orgCheck } = await supabase.from("organizations").select("visibility").eq("id", orgId).single();
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (agentId) {
    // Filter: conversations where this agent is a participant
    const { data: participantRows } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("agent_id", agentId);

    const convIds = (participantRows ?? []).map((r) => r.conversation_id);

    if (convIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("id, org_id, agent_id, title, created_at, updated_at")
      .eq("org_id", orgId)
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[organizations/conversations] Failed to fetch conversations by agent:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const conversations = await enrichConversations(supabase, data ?? []);
    return NextResponse.json(conversations);
  }

  // No filter: all conversations for this org
  const { data, error } = await supabase
    .from("conversations")
    .select("id, org_id, agent_id, title, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[organizations/conversations] Failed to fetch conversations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const conversations = await enrichConversations(supabase, data ?? []);
  return NextResponse.json(conversations);
}

async function enrichConversations(
  supabase: ReturnType<typeof getSupabase>,
  rows: { id: string; org_id: string; agent_id: string | null; title: string; created_at: string; updated_at: string }[]
) {
  return Promise.all(
    rows.map(async (conv) => {
      const [msgsRes, participantsRes] = await Promise.all([
        supabase
          .from("messages")
          .select("content, role")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("conversation_participants")
          .select("id, conversation_id, agent_id, joined_at, agents(name, vendor)")
          .eq("conversation_id", conv.id),
      ]);

      const lastMsg = msgsRes.data?.[0];
      const participants = (participantsRes.data ?? []).map((p: Record<string, unknown>) => {
        const agent = p.agents as { name: string; vendor: string } | null;
        return {
          id: p.id as string,
          conversationId: p.conversation_id as string,
          agentId: p.agent_id as string,
          agentName: agent?.name ?? undefined,
          agentVendor: agent?.vendor ?? undefined,
          joinedAt: p.joined_at as string,
        };
      });

      return {
        id: conv.id,
        orgId: conv.org_id,
        agentId: conv.agent_id,
        title: conv.title,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        lastMessage: lastMsg ? `${lastMsg.role === "user" ? "You" : "AI"}: ${lastMsg.content.slice(0, 80)}` : undefined,
        participants,
      };
    })
  );
}
