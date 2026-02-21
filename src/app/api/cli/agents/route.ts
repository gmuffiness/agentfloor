import { NextRequest, NextResponse } from "next/server";
import { requireCliAuth } from "@/lib/cli-auth";
import { getSupabase } from "@/db/supabase";

/**
 * GET /api/cli/agents?orgId=X
 * List all agents in the specified organization.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCliAuth(request);
  if (auth instanceof NextResponse) return auth;

  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json(
      { error: "orgId query parameter is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  // Verify membership
  const { data: member } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 },
    );
  }

  // Get departments for this org
  const { data: depts } = await supabase
    .from("departments")
    .select("id, name")
    .eq("org_id", orgId);

  if (!depts?.length) {
    return NextResponse.json({ agents: [] });
  }

  const deptIds = depts.map((d) => d.id);
  const deptNameMap = Object.fromEntries(depts.map((d) => [d.id, d.name]));

  // Get agents
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, vendor, model, status, dept_id, last_active, description")
    .in("dept_id", deptIds)
    .order("name");

  if (agentsError) {
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }

  const result = (agents ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    vendor: a.vendor,
    model: a.model,
    status: a.status,
    description: a.description,
    departmentName: deptNameMap[a.dept_id] ?? "Unknown",
    lastActive: a.last_active,
  }));

  return NextResponse.json({ agents: result });
}
