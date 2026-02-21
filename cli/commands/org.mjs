/**
 * agent-factorio org — Organization management subcommands
 */
import { ask, choose } from "../lib/prompt.mjs";
import { readGlobalConfig, writeGlobalConfig, getDefaultOrg, upsertOrg } from "../lib/config.mjs";
import { apiCall, authApiCall } from "../lib/api.mjs";
import { success, error, info, label, heading, dim } from "../lib/log.mjs";

/**
 * org list — List all organizations the user belongs to
 */
export async function orgListCommand() {
  try {
    const res = await authApiCall("/api/cli/orgs");
    if (!res.ok) {
      error(res.data?.error || "Failed to fetch organizations");
      process.exit(1);
    }

    const { organizations } = res.data;
    if (!organizations.length) {
      info("You are not a member of any organizations.");
      info("Run `agent-factorio org create` or `agent-factorio org join` to get started.");
      return;
    }

    const config = readGlobalConfig();
    const defaultOrgId = config?.defaultOrg;

    heading("Organizations");
    console.log("");

    for (const org of organizations) {
      const isDefault = org.orgId === defaultOrgId;
      const marker = isDefault ? " (default)" : "";
      console.log(`  ${org.orgName}${marker}`);
      label("    ID", org.orgId);
      label("    Role", org.role);
      label("    Invite Code", org.inviteCode);
      label("    Members", String(org.memberCount));
      label("    Agents", String(org.agentCount));
      console.log("");
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

/**
 * org create <name> — Create a new organization
 */
export async function orgCreateCommand(name) {
  const org = getDefaultOrg();
  if (!org) {
    error("Not logged in. Run `agent-factorio login` first.");
    process.exit(1);
  }

  const orgName = name || await ask("Organization name");
  if (!orgName) {
    error("Organization name is required.");
    process.exit(1);
  }

  const res = await apiCall(org.hubUrl, "/api/cli/login", {
    body: {
      action: "create",
      orgName,
      memberName: org.memberName || "CLI User",
      email: org.email,
      userId: org.userId,
    },
  });

  if (!res.ok) {
    error(`Failed to create organization: ${res.data?.error || "Unknown error"}`);
    process.exit(1);
  }

  const { orgId, orgName: createdName, inviteCode, memberId, authToken } = res.data;
  upsertOrg({
    hubUrl: org.hubUrl,
    orgId,
    orgName: createdName,
    inviteCode,
    memberName: org.memberName,
    email: org.email,
    memberId,
    userId: org.userId,
    authToken,
  });

  success(`Created "${createdName}" (${orgId})`);
  info(`Invite code: ${inviteCode} — share with your team!`);
}

/**
 * org join <inviteCode> — Join an organization via invite code
 */
export async function orgJoinCommand(code) {
  const org = getDefaultOrg();
  if (!org) {
    error("Not logged in. Run `agent-factorio login` first.");
    process.exit(1);
  }

  const inviteCode = code || await ask("Invite code");
  if (!inviteCode) {
    error("Invite code is required.");
    process.exit(1);
  }

  const res = await apiCall(org.hubUrl, "/api/cli/login", {
    body: {
      action: "join",
      inviteCode,
      memberName: org.memberName || "CLI User",
      email: org.email,
      userId: org.userId,
    },
  });

  if (!res.ok) {
    error(`Failed to join: ${res.data?.error || "Invalid invite code"}`);
    process.exit(1);
  }

  const { orgId, orgName, memberId, authToken } = res.data;
  upsertOrg({
    hubUrl: org.hubUrl,
    orgId,
    orgName,
    inviteCode: inviteCode.toUpperCase(),
    memberName: org.memberName,
    email: org.email,
    memberId,
    userId: org.userId,
    authToken,
  });

  success(`Joined "${orgName}" (${orgId})`);
}

/**
 * org switch — Interactively select the default organization
 */
export async function orgSwitchCommand() {
  const config = readGlobalConfig();
  if (!config?.organizations?.length) {
    error("No organizations found. Run `agent-factorio login` first.");
    process.exit(1);
  }

  if (config.organizations.length === 1) {
    info(`Only one organization: "${config.organizations[0].orgName}". Already set as default.`);
    return;
  }

  const options = config.organizations.map((o) => {
    const marker = o.orgId === config.defaultOrg ? " (current)" : "";
    return `${o.orgName}${marker}`;
  });

  const { index } = await choose("Select default organization", options);
  const selected = config.organizations[index];

  config.defaultOrg = selected.orgId;
  writeGlobalConfig(config);

  success(`Default organization set to "${selected.orgName}" (${selected.orgId})`);
}

/**
 * org info — Show details about the current default organization
 */
export async function orgInfoCommand() {
  const org = getDefaultOrg();
  if (!org) {
    error("Not logged in. Run `agent-factorio login` first.");
    process.exit(1);
  }

  try {
    const res = await authApiCall("/api/cli/orgs");
    if (!res.ok) {
      // Fallback to local config info
      heading("Organization (local config)");
      console.log("");
      label("  Name", org.orgName);
      label("  ID", org.orgId);
      label("  Invite Code", org.inviteCode);
      label("  Hub", org.hubUrl);
      return;
    }

    const match = res.data.organizations.find((o) => o.orgId === org.orgId);
    if (!match) {
      info("Organization not found on hub. Showing local config.");
      label("  Name", org.orgName);
      label("  ID", org.orgId);
      label("  Hub", org.hubUrl);
      return;
    }

    heading("Organization");
    console.log("");
    label("  Name", match.orgName);
    label("  ID", match.orgId);
    label("  Role", match.role);
    label("  Invite Code", match.inviteCode);
    label("  Members", String(match.memberCount));
    label("  Agents", String(match.agentCount));
    label("  Hub", org.hubUrl);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}
