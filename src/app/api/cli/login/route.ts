import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { createCliAuthToken } from "@/lib/cli-auth";
import { randomUUID } from "crypto";
import { generateInviteCode } from "@/lib/invite-code";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/cli/login
 * CLI login endpoint with browser-based authentication.
 * Actions:
 *   - { action: "init-browser-login" } — create login session, return loginToken + browser URL
 *   - { action: "check-verification", loginToken } — poll verification status
 *   - { action: "join", inviteCode, email, userId, memberName? } — join existing org
 *   - { action: "create", orgName, email, userId, memberName? } — create new org
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  // Rate limit everything except verification polling (which fires every 2s)
  if (action !== "check-verification") {
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = checkRateLimit(`cli-login:${ip}`, { maxRequests: 10, windowMs: 60_000 });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 60000) / 1000)) } });
    }
  }

  const supabase = getSupabase();

  // --- Initialize browser-based login session ---
  if (action === "init-browser-login") {
    const loginToken = randomUUID();

    const { error: insertError } = await supabase
      .from("cli_login_sessions")
      .insert({ token: loginToken });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create login session" },
        { status: 500 },
      );
    }

    const hubUrl = request.nextUrl.origin;
    const loginUrl = `${hubUrl}/cli/login?loginToken=${loginToken}`;

    return NextResponse.json({ loginToken, loginUrl });
  }

  // --- Check verification status (polling) ---
  if (action === "check-verification") {
    const { loginToken } = body;
    if (!loginToken) {
      return NextResponse.json(
        { error: "loginToken is required" },
        { status: 400 },
      );
    }

    const { data: session, error: fetchError } = await supabase
      .from("cli_login_sessions")
      .select("verified, user_id, email, expires_at")
      .eq("token", loginToken)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: "Login session not found" },
        { status: 404 },
      );
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from("cli_login_sessions")
        .delete()
        .eq("token", loginToken);
      return NextResponse.json(
        { error: "Login session expired" },
        { status: 410 },
      );
    }

    if (!session.verified) {
      return NextResponse.json({ verified: false });
    }

    // Clean up used session
    await supabase
      .from("cli_login_sessions")
      .delete()
      .eq("token", loginToken);

    return NextResponse.json({
      verified: true,
      userId: session.user_id,
      email: session.email,
    });
  }

  // --- Join or Create (require verified userId) ---
  const { email, userId, inviteCode, orgName, memberName } = body;

  if (!email) {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 },
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required. Complete email verification first." },
      { status: 400 },
    );
  }

  if (action === "join") {
    if (!inviteCode) {
      return NextResponse.json(
        { error: "inviteCode is required" },
        { status: 400 },
      );
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, invite_code")
      .eq("invite_code", inviteCode.toUpperCase())
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 404 },
      );
    }

    const displayName = memberName || "CLI User";
    const now = new Date().toISOString();

    // Check if member with same email already exists in this org
    const { data: existing } = await supabase
      .from("org_members")
      .select("id, role")
      .eq("org_id", org.id)
      .eq("email", email)
      .maybeSingle();

    let memberId: string;

    if (existing) {
      memberId = existing.id;
      // Update user_id if not set
      await supabase
        .from("org_members")
        .update({ user_id: userId })
        .eq("id", memberId);
    } else {
      memberId = `member-${Date.now()}`;
      await supabase.from("org_members").insert({
        id: memberId,
        org_id: org.id,
        name: displayName,
        email,
        role: "member",
        status: "active",
        user_id: userId,
        joined_at: now,
      });
    }

    const joinAuthToken = await createCliAuthToken(userId, memberId, email);

    return NextResponse.json({
      orgId: org.id,
      orgName: org.name,
      inviteCode: org.invite_code,
      memberId,
      authToken: joinAuthToken,
    });
  }

  if (action === "create") {
    if (!orgName) {
      return NextResponse.json(
        { error: "orgName is required" },
        { status: 400 },
      );
    }

    const id = `org-${Date.now()}`;
    const now = new Date().toISOString();
    const code = generateInviteCode();
    const displayName = memberName || "CLI User";
    const memberId = `member-${Date.now()}`;

    const { error: orgError } = await supabase.from("organizations").insert({
      id,
      name: orgName,
      total_budget: 0,
      invite_code: code,
      created_by: displayName,
      creator_user_id: userId,
      created_at: now,
    });

    if (orgError) {
      console.error("[cli/login] Failed to create organization:", orgError);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Add creator as admin member
    await supabase.from("org_members").insert({
      id: memberId,
      org_id: id,
      name: displayName,
      email,
      role: "admin",
      status: "active",
      user_id: userId,
      joined_at: now,
    });

    const createAuthToken = await createCliAuthToken(userId, memberId, email);

    return NextResponse.json(
      { orgId: id, orgName, inviteCode: code, memberId, authToken: createAuthToken },
      { status: 201 },
    );
  }

  return NextResponse.json(
    { error: 'Invalid action. Use "init-browser-login", "check-verification", "join", or "create".' },
    { status: 400 },
  );
}
