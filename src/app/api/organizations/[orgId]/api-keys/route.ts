import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember, requireOrgAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

/**
 * GET — Check which vendor API keys are configured (without revealing values).
 * Any org member can check; public orgs skip auth.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const supabase = getSupabase();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("visibility, anthropic_api_key, openai_api_key")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (org.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

  // Never expose actual keys — only return whether they are set
  return NextResponse.json({
    orgKeys: {
      anthropic: !!org.anthropic_api_key,
      openai: !!org.openai_api_key,
    },
  });
}

/**
 * PATCH — Set or clear vendor API keys.
 * Keys are encrypted with AES-256-GCM before storage.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const body = await request.json() as {
    anthropicApiKey?: string | null;
    openaiApiKey?: string | null;
  };

  const updates: Record<string, string | null> = {};
  if (body.anthropicApiKey !== undefined) {
    updates.anthropic_api_key = body.anthropicApiKey ? encrypt(body.anthropicApiKey) : null;
  }
  if (body.openaiApiKey !== undefined) {
    updates.openai_api_key = body.openaiApiKey ? encrypt(body.openaiApiKey) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", orgId);

  if (error) {
    return NextResponse.json({ error: "Failed to save API keys" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
