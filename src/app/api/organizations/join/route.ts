import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const body = await request.json();
  const { inviteCode } = body;

  if (!inviteCode) {
    return NextResponse.json(
      { error: "inviteCode is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  // Find organization by invite code
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("invite_code", inviteCode.toUpperCase())
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 404 },
    );
  }

  // Check if already a member (by user_id)
  const { data: existing } = await supabase
    .from("org_members")
    .select("id, role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      orgId: org.id,
      orgName: org.name,
      role: existing.role,
      message: "Already a member",
    });
  }

  // Add as member
  const now = new Date().toISOString();
  const displayName = user.user_metadata?.full_name ?? user.email ?? "Unknown";

  const { error: memberError } = await supabase.from("org_members").insert({
    id: `member-${Date.now()}`,
    org_id: org.id,
    name: displayName,
    email: user.email ?? null,
    role: "member",
    status: "active",
    user_id: user.id,
    joined_at: now,
  });

  if (memberError) {
    console.error("[organizations/join] Failed to add member:", memberError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    orgId: org.id,
    orgName: org.name,
    role: "member",
  });
}
