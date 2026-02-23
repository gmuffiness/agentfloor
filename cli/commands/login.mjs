/**
 * agent-factorio login — Connect to hub + join organization (with email verification)
 */
import { ask, choose } from "../lib/prompt.mjs";
import { readGlobalConfig, upsertOrg } from "../lib/config.mjs";
import { apiCall, checkHub } from "../lib/api.mjs";
import { success, error, info, dim } from "../lib/log.mjs";

/**
 * Poll verification status until verified or expired
 * @param {string} hubUrl
 * @param {string} loginToken
 * @returns {Promise<{ userId: string, email: string }>}
 */
async function waitForVerification(hubUrl, loginToken) {
  const POLL_INTERVAL = 2000; // 2 seconds
  const MAX_WAIT = 10 * 60 * 1000; // 10 minutes
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT) {
    const res = await apiCall(hubUrl, "/api/cli/login", {
      body: { action: "check-verification", loginToken },
    });

    if (res.status === 410) {
      throw new Error("Verification link expired. Please try again.");
    }

    if (!res.ok) {
      throw new Error(res.data?.error || "Verification check failed.");
    }

    if (res.data.verified) {
      return { userId: res.data.userId, email: res.data.email };
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error("Verification timed out. Please try again.");
}

const DEFAULT_HUB_URL = "https://agent-factorio.vercel.app";

export async function loginCommand(options = {}) {
  const existing = readGlobalConfig();
  const hubUrl = options.hubUrl || existing?.organizations?.[0]?.hubUrl || DEFAULT_HUB_URL;

  // Check connectivity
  const reachable = await checkHub(hubUrl);
  if (!reachable) {
    error(`Cannot connect to ${hubUrl}. Is the hub running?`);
    process.exit(1);
  }

  // 2. Email input
  const email = await ask("Your email (used as your identifier)");
  if (!email) {
    error("Email is required.");
    process.exit(1);
  }

  // 3. Send verification email
  info("Sending verification email...");
  const sendRes = await apiCall(hubUrl, "/api/cli/login", {
    body: { action: "send-verification", email },
  });

  if (!sendRes.ok) {
    error(`Failed to send verification email: ${sendRes.data?.error || "Unknown error"}`);
    process.exit(1);
  }

  const { loginToken } = sendRes.data;
  success("Verification email sent!");
  info("Check your inbox and click the verification link.");
  dim("Waiting for verification...");

  // 4. Poll for verification
  let userId;
  try {
    const result = await waitForVerification(hubUrl, loginToken);
    userId = result.userId;
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  success("Email verified!");

  // 5. Name input
  const memberName = await ask("Your name (displayed in the org)", "CLI User");

  // 6. Create or Join
  const { index: actionIdx } = await choose("Create or join an organization?", [
    "Create new",
    "Join existing (invite code)",
  ]);

  if (actionIdx === 0) {
    // Create new org
    const orgName = await ask("Organization name");
    if (!orgName) {
      error("Organization name is required.");
      process.exit(1);
    }

    const res = await apiCall(hubUrl, "/api/cli/login", {
      body: { action: "create", orgName, memberName, email, userId },
    });

    if (!res.ok) {
      error(`Failed to create organization: ${res.data?.error || "Unknown error"}`);
      process.exit(1);
    }

    const { orgId, orgName: name, inviteCode, memberId, authToken } = res.data;
    upsertOrg({ hubUrl, orgId, orgName: name, inviteCode, memberName, email, memberId, userId, authToken });

    success(`Created "${name}" (${orgId})`);
    info(`Invite code: ${inviteCode} — share with your team!`);
  } else {
    // Join existing
    const inviteCode = await ask("Invite code");
    if (!inviteCode) {
      error("Invite code is required.");
      process.exit(1);
    }

    const res = await apiCall(hubUrl, "/api/cli/login", {
      body: { action: "join", inviteCode, memberName, email, userId },
    });

    if (!res.ok) {
      error(`Failed to join: ${res.data?.error || "Invalid invite code"}`);
      process.exit(1);
    }

    const { orgId, orgName, memberId, authToken } = res.data;
    upsertOrg({ hubUrl, orgId, orgName, inviteCode: inviteCode.toUpperCase(), memberName, email, memberId, userId, authToken });

    success(`Joined "${orgName}" (${orgId})`);
  }

  console.log("\nLogged in! Run `agent-factorio push` in any project to register an agent.");
}
