import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { inviteCode, memberName } = body;

  if (!inviteCode || !memberName) {
    return NextResponse.json(
      { error: "inviteCode and memberName are required" },
      { status: 400 }
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
      { status: 404 }
    );
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", org.id)
    .eq("name", memberName)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { orgId: org.id, orgName: org.name, role: "member", message: "Already a member" },
    );
  }

  // Add as member
  const now = new Date().toISOString();
  const { error: memberError } = await supabase.from("org_members").insert({
    id: `member-${Date.now()}`,
    org_id: org.id,
    name: memberName,
    role: "member",
    status: "active",
    joined_at: now,
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({
    orgId: org.id,
    orgName: org.name,
    role: "member",
  });
}
