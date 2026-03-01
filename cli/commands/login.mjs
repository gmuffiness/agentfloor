/**
 * agent-factorio login — Browser-based authentication (like Claude Code /login)
 */
import { ask, choose } from "../lib/prompt.mjs";
import { readGlobalConfig, upsertOrg } from "../lib/config.mjs";
import { apiCall, checkHub } from "../lib/api.mjs";
import { success, error, info, dim } from "../lib/log.mjs";

/**
 * Try to open a URL in the default browser
 * @param {string} url
 */
async function openBrowser(url) {
  const { exec } = await import("child_process");
  const { platform } = await import("os");

  const cmd =
    platform() === "darwin"
      ? `open "${url}"`
      : platform() === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  return new Promise((resolve) => {
    exec(cmd, (err) => resolve(!err));
  });
}

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
      throw new Error("Login session expired. Please try again.");
    }

    if (!res.ok) {
      throw new Error(res.data?.error || "Verification check failed.");
    }

    if (res.data.verified) {
      return { userId: res.data.userId, email: res.data.email };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error("Login timed out. Please try again.");
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

  // 1. Initialize browser login session
  const initRes = await apiCall(hubUrl, "/api/cli/login", {
    body: { action: "init-browser-login" },
  });

  if (!initRes.ok) {
    error(`Failed to initialize login: ${initRes.data?.error || "Unknown error"}`);
    process.exit(1);
  }

  const { loginToken, loginUrl } = initRes.data;

  // 2. Open browser
  const opened = await openBrowser(loginUrl);
  if (!opened) {
    console.log();
    info("Browser didn't open? Use the url below to sign in:");
    console.log(`  ${loginUrl}`);
  }

  console.log();
  dim("Waiting for sign-in...");

  // 3. Poll for verification
  let userId, email;
  try {
    const result = await waitForVerification(hubUrl, loginToken);
    userId = result.userId;
    email = result.email;
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  success(`Logged in as ${email}`);

  // 4. Name input
  const memberName = await ask("Your name (displayed in the org)", "CLI User");

  // 5. Create or Join
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

  console.log("\nLogin successful! Run `agent-factorio push` in any project to register an agent.");
}
