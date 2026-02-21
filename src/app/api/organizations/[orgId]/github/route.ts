import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/db/supabase";
import { requireOrgMember, requireOrgAdmin } from "@/lib/auth";
import { getInstallationUrl, generateJWT, getInstallationInfo } from "@/lib/github-app";

/**
 * GET — List GitHub installations for this org.
 * Also returns the installation URL for connecting new accounts,
 * and available (unlinked) installations from the GitHub App.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const supabase = getSupabase();
  const { data: orgCheck } = await supabase.from("organizations").select("visibility").eq("id", orgId).single();
  if (!orgCheck || orgCheck.visibility !== "public") {
    const memberCheck = await requireOrgMember(orgId);
    if (memberCheck instanceof NextResponse) return memberCheck;
  }

  const { data: installations, error } = await supabase
    .from("github_installations")
    .select("id, installation_id, github_account_login, github_account_type, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let installUrl: string | null = null;
  try {
    installUrl = getInstallationUrl(orgId);
  } catch {
    // GITHUB_APP_CLIENT_ID not configured — GitHub integration unavailable
  }

  // Fetch all App installations from GitHub to find unlinked ones
  const linkedIds = new Set((installations ?? []).map((i) => i.installation_id));
  let availableInstallations: { installation_id: number; account_login: string; account_type: string }[] = [];

  try {
    const jwt = generateJWT();
    const res = await fetch("https://api.github.com/app/installations", {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "AgentFactorio-GitHub-App",
      },
    });
    if (res.ok) {
      const allInstallations = await res.json();
      availableInstallations = (allInstallations as { id: number; account: { login: string; type: string } }[])
        .filter((i) => !linkedIds.has(i.id))
        .map((i) => ({
          installation_id: i.id,
          account_login: i.account.login,
          account_type: i.account.type,
        }));
    }
  } catch {
    // GitHub App not configured or JWT generation failed
  }

  return NextResponse.json({
    installations: installations ?? [],
    installUrl,
    availableInstallations,
  });
}

/**
 * POST — Link an existing GitHub App installation to this org.
 * Used when the App is already installed on the user's GitHub account
 * but not yet linked to this AgentFactorio org.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const body = await request.json();
  const { installationId } = body;

  if (!installationId) {
    return NextResponse.json(
      { error: "installationId is required" },
      { status: 400 }
    );
  }

  try {
    // Verify the installation exists on GitHub
    const info = await getInstallationInfo(Number(installationId));

    const supabase = getSupabase();
    const now = new Date().toISOString();

    await supabase.from("github_installations").upsert(
      {
        id: `ghi-${orgId}-${installationId}`,
        org_id: orgId,
        installation_id: Number(installationId),
        github_account_login: info.account_login,
        github_account_type: info.account_type,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "org_id,installation_id" }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to link installation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE — Remove a GitHub installation link (DB only).
 * The user must manually uninstall the GitHub App from GitHub settings.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const adminCheck = await requireOrgAdmin(orgId);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const body = await request.json();
  const { installationId } = body;

  if (!installationId) {
    return NextResponse.json(
      { error: "installationId is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from("github_installations")
    .delete()
    .eq("org_id", orgId)
    .eq("id", installationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
