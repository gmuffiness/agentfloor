import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const adminResult = await requireOrgAdmin(orgId);
  if (adminResult instanceof NextResponse) return adminResult;

  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  // Get the org's invite code for auto-join after accepting
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("invite_code")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;
  const redirectTo = `${origin}/auth/callback?next=/join-auto/${org.invite_code}`;

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
