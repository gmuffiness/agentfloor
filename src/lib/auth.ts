import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/db/supabase-server";
import { getSupabase } from "@/db/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthResult {
  user: User;
}

interface OrgMemberResult {
  user: User;
  role: string;
}

export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user };
}

export async function requireOrgMember(orgId: string): Promise<OrgMemberResult | NextResponse> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const supabase = getSupabase();

  const { data: member } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user, role: member.role };
}

export async function requireOrgAdmin(orgId: string): Promise<OrgMemberResult | NextResponse> {
  const result = await requireOrgMember(orgId);
  if (result instanceof NextResponse) return result;

  if (result.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return result;
}
