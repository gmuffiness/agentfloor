/**
 * GitHub App helpers for installation-based authentication.
 *
 * Provides JWT generation, installation token retrieval,
 * and installation URL construction for the GitHub App OAuth flow.
 */

import crypto from "node:crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { createGitHubState } from "@/lib/github-state";

/**
 * Generate a JWT for GitHub App authentication.
 * Uses the App's private key to sign a short-lived token via Node.js crypto.
 */
export function generateJWT(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY");
  }

  // Decode PEM — env vars may use literal \n
  const pem = privateKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 10 * 60,
      iss: appId,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(pem);

  return `${header}.${payload}.${base64url(signature)}`;
}

function base64url(input: string | Buffer): string {
  const b64 =
    typeof input === "string"
      ? Buffer.from(input).toString("base64")
      : input.toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Get an installation access token for a given installation ID.
 * These tokens are valid for 1 hour.
 */
export async function getInstallationToken(
  installationId: number | bigint
): Promise<string> {
  const jwt = generateJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "AgentFactorio-GitHub-App",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Failed to get installation token (${res.status}): ${err}`
    );
  }

  const data = await res.json();
  return data.token as string;
}

/**
 * Get installation details from GitHub API.
 */
export async function getInstallationInfo(
  installationId: number | bigint
): Promise<{ account_login: string; account_type: string }> {
  const jwt = generateJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "AgentFactorio-GitHub-App",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Failed to get installation info (${res.status}): ${err}`
    );
  }

  const data = await res.json();
  return {
    account_login: data.account?.login ?? "",
    account_type: data.account?.type ?? "User",
  };
}

/**
 * Build the GitHub App installation URL.
 * Encodes a signed CSRF state token so the callback can verify and extract the orgId.
 */
export function getInstallationUrl(orgId: string): string {
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing GITHUB_APP_CLIENT_ID");
  }

  const appSlug = process.env.GITHUB_APP_SLUG || "agent-factorio";
  const state = encodeURIComponent(createGitHubState(orgId));
  return `https://github.com/apps/${appSlug}/installations/new?state=${state}`;
}

/**
 * Find an installation that matches a given repo owner for an org.
 * Looks up github_installations where github_account_login matches the owner.
 */
export async function findInstallationForRepo(
  supabase: SupabaseClient,
  orgId: string,
  owner: string
): Promise<{ installation_id: number } | null> {
  const { data } = await supabase
    .from("github_installations")
    .select("installation_id")
    .eq("org_id", orgId)
    .ilike("github_account_login", owner)
    .maybeSingle();

  if (!data) return null;
  return { installation_id: Number(data.installation_id) };
}
