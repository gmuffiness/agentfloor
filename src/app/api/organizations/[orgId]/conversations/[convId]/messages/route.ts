import { NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; convId: string }> }
) {
  const { orgId, convId } = await params;

  const supabase = getSupabase();

  // Auth check — skip for public orgs
  const { data: orgCheck } = await supabase.from("organizations").select("visibility").eq("id", orgId).single();
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at, agent_id, agents(name, vendor)")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[organizations/conversations/messages] Failed to fetch messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const messages = (data ?? []).map((m: Record<string, unknown>) => {
    const agent = m.agents as { name: string; vendor: string } | null;
    return {
      id: m.id as string,
      conversationId: m.conversation_id as string,
      role: m.role as string,
      content: m.content as string,
      createdAt: m.created_at as string,
      agentId: (m.agent_id as string) ?? null,
      agentName: agent?.name ?? null,
      agentVendor: agent?.vendor ?? null,
    };
  });

  return NextResponse.json(messages);
}
