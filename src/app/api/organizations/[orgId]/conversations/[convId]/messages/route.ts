import { NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; convId: string }> }
) {
  const { orgId, convId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = (data ?? []).map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));

  return NextResponse.json(messages);
}
