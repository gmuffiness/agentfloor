import { NextRequest, NextResponse } from "next/server";
import { requireCliAuth } from "@/lib/cli-auth";
import { getSupabase } from "@/db/supabase";

/**
 * GET /api/cli/orgs
 * List all organizations the authenticated CLI user belongs to.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCliAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabase();

  // Find all orgs this user is a member of
  const { data: memberships, error: memberError } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", auth.userId);

  if (memberError) {
    return NextResponse.json(
      { error: "Failed to fetch memberships" },
      { status: 500 },
    );
  }

  if (!memberships?.length) {
    return NextResponse.json({ organizations: [] });
  }

  const orgIds = memberships.map((m) => m.org_id);
  const roleMap = Object.fromEntries(memberships.map((m) => [m.org_id, m.role]));

  // Fetch org details
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, invite_code")
    .in("id", orgIds);

  if (!orgs) {
    return NextResponse.json({ organizations: [] });
  }

  // Count members and agents per org
  const organizations = await Promise.all(
    orgs.map(async (org) => {
      const { count: memberCount } = await supabase
        .from("org_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id);

      const { data: depts } = await supabase
        .from("departments")
        .select("id")
        .eq("org_id", org.id);

      let agentCount = 0;
      if (depts?.length) {
        const deptIds = depts.map((d) => d.id);
        const { count } = await supabase
          .from("agents")
          .select("id", { count: "exact", head: true })
          .in("dept_id", deptIds);
        agentCount = count ?? 0;
      }

      return {
        orgId: org.id,
        orgName: org.name,
        inviteCode: org.invite_code,
        role: roleMap[org.id],
        memberCount: memberCount ?? 0,
        agentCount,
      };
    }),
  );

  return NextResponse.json({ organizations });
}
