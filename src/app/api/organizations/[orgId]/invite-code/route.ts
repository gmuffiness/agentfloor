import { NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgAdmin } from "@/lib/auth";
import { generateInviteCode } from "@/lib/invite-code";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const authResult = await requireOrgAdmin(orgId);
  if (authResult instanceof NextResponse) return authResult;

  const supabase = getSupabase();
  const newCode = generateInviteCode();

  const { error } = await supabase
    .from("organizations")
    .update({ invite_code: newCode })
    .eq("id", orgId);

  if (error) {
    console.error("[organizations/invite-code] Failed to update invite code:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ inviteCode: newCode });
}
