import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from("humans")
    .select("*")
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (rows ?? []).map((h) => ({
    id: h.id,
    orgId: h.org_id,
    name: h.name,
    email: h.email,
    role: h.role,
    avatarUrl: h.avatar_url,
    createdAt: h.created_at,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const memberCheck = await requireOrgMember(orgId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const body = await request.json();
  const supabase = getSupabase();

  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = `human-${Date.now()}`;
  const now = new Date().toISOString();

  const { error } = await supabase.from("humans").insert({
    id,
    org_id: orgId,
    name: body.name,
    email: body.email ?? "",
    role: body.role ?? "",
    avatar_url: body.avatarUrl ?? "",
    created_at: now,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id }, { status: 201 });
}
