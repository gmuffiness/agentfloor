import { NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const supabase = getSupabase();

  const { data: orgCheck } = await supabase.from("organizations").select("visibility").eq("id", orgId).single();
  let currentUserRole: string = "viewer";
  let currentUserId: string | null = null;

  if (!orgCheck || orgCheck.visibility !== "public") {
    const authResult = await requireOrgMember(orgId);
    if (authResult instanceof NextResponse) return authResult;
    currentUserRole = authResult.role;
    currentUserId = authResult.user.id;
  }

  const { data: members, error } = await supabase
    .from("org_members")
    .select("id, name, email, role, status, user_id, avatar_url, joined_at")
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
    avatarUrl: m.avatar_url ?? "",
    joinedAt: m.joined_at,
  }));

  // Find current user's member ID
  const currentMember = currentUserId ? (members ?? []).find((m) => m.user_id === currentUserId) : null;

  return NextResponse.json({
    members: formattedMembers,
    currentUserRole,
    currentMemberId: currentMember?.id ?? null,
    inviteCode,
  });
}
