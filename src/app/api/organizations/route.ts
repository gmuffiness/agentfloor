import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgs = (data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    totalBudget: o.total_budget,
    inviteCode: o.invite_code,
    createdBy: o.created_by,
    createdAt: o.created_at,
  }));

  return NextResponse.json(orgs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, budget, createdBy } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const id = `org-${Date.now()}`;
  const now = new Date().toISOString();
  const inviteCode = generateInviteCode();

  const { error: orgError } = await supabase.from("organizations").insert({
    id,
    name,
    total_budget: budget ?? 0,
    invite_code: inviteCode,
    created_by: createdBy ?? null,
    created_at: now,
  });

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  // Add creator as admin member
  if (createdBy) {
    await supabase.from("org_members").insert({
      id: `member-${Date.now()}`,
      org_id: id,
      name: createdBy,
      role: "admin",
      status: "active",
      joined_at: now,
    });
  }

  return NextResponse.json({ id, name, inviteCode }, { status: 201 });
}
