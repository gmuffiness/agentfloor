import { NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const authResult = await requireOrgMember(orgId);
  if (authResult instanceof NextResponse) return authResult;

  const { role: currentUserRole } = authResult;
  const supabase = getSupabase();

  const { data: members, error } = await supabase
    .from("org_members")
    .select("id, name, email, role, status, user_id, joined_at")
    .eq("org_id", orgId)
    .order("joined_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get invite code (only if admin)
  let inviteCode: string | null = null;
  if (currentUserRole === "admin") {
    const { data: org } = await supabase
      .from("organizations")
      .select("invite_code")
      .eq("id", orgId)
      .single();
    inviteCode = org?.invite_code ?? null;
  }

  // Get creator_user_id for the org
  const { data: org } = await supabase
    .from("organizations")
    .select("creator_user_id")
    .eq("id", orgId)
    .single();

  const formattedMembers = (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.status,
    userId: m.user_id,
    isCreator: m.user_id === org?.creator_user_id,
    joinedAt: m.joined_at,
  }));

  return NextResponse.json({
    members: formattedMembers,
    currentUserRole,
    inviteCode,
  });
}
