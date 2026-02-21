/**
 * GitHub OAuth state parameter utilities for CSRF protection.
 *
 * State format: `orgId:timestamp:hmac`
 * - orgId: the organization ID to link after installation
 * - timestamp: Unix seconds (ms precision) when state was created
 * - hmac: HMAC-SHA256 signature over "orgId:timestamp" using GITHUB_APP_CLIENT_SECRET
 *
 * Max age: 10 minutes.
 */

import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing GITHUB_APP_CLIENT_SECRET");
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("hex");
}

/**
 * Create a signed state token encoding the orgId.
 */
export function createGitHubState(orgId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${orgId}:${timestamp}`;
  const hmac = sign(payload);
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * Verify a state token and return the orgId if valid.
 * Returns null if the state is invalid or expired.
 */
export function verifyGitHubState(state: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return null;
  }

  // Expected format: orgId:timestamp:hmac
  const lastColon = decoded.lastIndexOf(":");
  if (lastColon === -1) return null;

  const hmacReceived = decoded.slice(lastColon + 1);
  const payload = decoded.slice(0, lastColon);

  // payload is "orgId:timestamp"
  const firstColon = payload.indexOf(":");
  if (firstColon === -1) return null;

  const orgId = payload.slice(0, firstColon);
  const timestampStr = payload.slice(firstColon + 1);
  const timestamp = Number(timestampStr);

  if (!orgId || !Number.isFinite(timestamp)) return null;

  // Check age
  if (Date.now() - timestamp > MAX_AGE_MS) return null;

  // Verify signature using timing-safe comparison
  const hmacExpected = sign(payload);
  const receivedBuf = Buffer.from(hmacReceived, "hex");
  const expectedBuf = Buffer.from(hmacExpected, "hex");

  if (receivedBuf.length !== expectedBuf.length) return null;

  try {
    if (!timingSafeEqual(receivedBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  return orgId;
}
