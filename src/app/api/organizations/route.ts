import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireAuth } from "@/lib/auth";
import { generateInviteCode } from "@/lib/invite-code";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const supabase = getSupabase();

  // Only return orgs the user belongs to
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (orgIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .in("id", orgIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[organizations] Failed to fetch organizations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const orgs = (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    domain: o.domain ?? "",
    totalBudget: o.total_budget,
    visibility: o.visibility ?? "private",
    inviteCode: o.invite_code,
    createdBy: o.created_by,
    createdAt: o.created_at,
  }));

  return NextResponse.json(orgs);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const body = await request.json();
  const { name, budget, visibility, domain } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const id = `org-${Date.now()}`;
  const now = new Date().toISOString();
  const inviteCode = generateInviteCode();
  const displayName = user.user_metadata?.full_name ?? user.email ?? "Unknown";

  const { error: orgError } = await supabase.from("organizations").insert({
    id,
    name,
    domain: domain ?? "",
    total_budget: budget ?? 0,
    visibility: visibility === "public" ? "public" : "private",
    invite_code: inviteCode,
    created_by: displayName,
    creator_user_id: user.id,
    created_at: now,
  });

  if (orgError) {
    console.error("[organizations] Failed to create organization:", orgError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Add creator as admin member
  await supabase.from("org_members").insert({
    id: `member-${Date.now()}`,
    org_id: id,
    name: displayName,
    email: user.email ?? null,
    role: "admin",
    status: "active",
    user_id: user.id,
    joined_at: now,
  });

  return NextResponse.json({ id, name, inviteCode, visibility: visibility === "public" ? "public" : "private" }, { status: 201 });
}
