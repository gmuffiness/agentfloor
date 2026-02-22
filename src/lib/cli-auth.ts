import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { randomBytes, createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface CliAuthResult {
  userId: string;
  memberId: string;
  email: string;
}

/**
 * Validate CLI auth token from Authorization header.
 * Returns user info or a 401 NextResponse.
 */
export async function requireCliAuth(
  request: NextRequest,
): Promise<CliAuthResult | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7);
  const hashedToken = hashToken(token);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("cli_auth_tokens")
    .select("user_id, member_id, email, expires_at")
    .eq("token", hashedToken)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Invalid or expired auth token" },
      { status: 401 },
    );
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Auth token has expired. Please run 'agent-factorio login' again." },
      { status: 401 },
    );
  }

  // Update last_used_at in background
  supabase
    .from("cli_auth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", hashedToken)
    .then(() => {});

  return {
    userId: data.user_id,
    memberId: data.member_id,
    email: data.email,
  };
}

/**
 * Generate and store a new CLI auth token.
 */
export async function createCliAuthToken(
  userId: string,
  memberId: string,
  email: string,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  const supabase = getSupabase();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("cli_auth_tokens").insert({
    token: hashedToken,
    user_id: userId,
    member_id: memberId,
    email,
    expires_at: expiresAt,
  });

  return token;
}
