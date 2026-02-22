import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgAdmin } from "@/lib/auth";

type Params = { params: Promise<{ orgId: string; memberId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { orgId, memberId } = await params;
  const authResult = await requireOrgAdmin(orgId);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { role } = body;

  if (!role || !["admin", "member"].includes(role)) {
    return NextResponse.json(
      { error: "role must be 'admin' or 'member'" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  // Get the target member
  const { data: target } = await supabase
    .from("org_members")
    .select("id, role, user_id")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent demoting last admin
  if (target.role === "admin" && role === "member") {
    const { count } = await supabase
      .from("org_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the last admin" },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase
    .from("org_members")
    .update({ role })
    .eq("id", memberId)
    .eq("org_id", orgId);

  if (error) {
    console.error("[organizations/members/memberId] Failed to update member role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { orgId, memberId } = await params;
  const authResult = await requireOrgAdmin(orgId);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const supabase = getSupabase();

  // Get the target member
  const { data: target } = await supabase
    .from("org_members")
    .select("id, user_id")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent removing yourself
  if (target.user_id === user.id) {
    return NextResponse.json(
      { error: "Cannot remove yourself" },
      { status: 400 },
    );
  }

  // Prevent removing org creator
  const { data: org } = await supabase
    .from("organizations")
    .select("creator_user_id")
    .eq("id", orgId)
    .single();

  if (target.user_id === org?.creator_user_id) {
    return NextResponse.json(
      { error: "Cannot remove the organization creator" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("org_members")
    .delete()
    .eq("id", memberId)
    .eq("org_id", orgId);

  if (error) {
    console.error("[organizations/members/memberId] Failed to delete member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
