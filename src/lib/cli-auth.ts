import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { randomBytes } from "crypto";

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
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("cli_auth_tokens")
    .select("user_id, member_id, email")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Invalid or expired auth token" },
      { status: 401 },
    );
  }

  // Update last_used_at in background
  supabase
    .from("cli_auth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token)
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
  const supabase = getSupabase();

  await supabase.from("cli_auth_tokens").insert({
    token,
    user_id: userId,
    member_id: memberId,
    email,
  });

  return token;
}
