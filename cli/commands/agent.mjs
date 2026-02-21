/**
 * agent-factorio agent — Agent management subcommands
 */
import * as fs from "fs";
import * as path from "path";
import { ask, confirm } from "../lib/prompt.mjs";
import { getDefaultOrg, readLocalConfig, writeLocalConfig, findProjectRoot } from "../lib/config.mjs";
import { authApiCall } from "../lib/api.mjs";
import { success, error, info, label, heading, dim } from "../lib/log.mjs";

/**
 * Resolve agent ID from argument or local config
 * @param {string} [idArg]
 * @returns {string}
 */
function resolveAgentId(idArg) {
  if (idArg) return idArg;

  const local = readLocalConfig();
  if (local?.agentId) return local.agentId;

  error("No agent ID specified and no local .agent-factorio/config.json found.");
  info("Run this command with an agent ID, or run it from a project with a registered agent.");
  process.exit(1);
}

/**
 * agent list — List all agents in the current organization
 */
export async function agentListCommand() {
  const org = getDefaultOrg();
  if (!org) {
    error("Not logged in. Run `agent-factorio login` first.");
    process.exit(1);
  }

  try {
    const res = await authApiCall(`/api/cli/agents?orgId=${org.orgId}`);
    if (!res.ok) {
      error(res.data?.error || "Failed to fetch agents");
      process.exit(1);
    }

    const { agents } = res.data;
    if (!agents.length) {
      info("No agents in this organization.");
      info("Run `agent-factorio push` from a project to register an agent.");
      return;
    }

    heading(`Agents in "${org.orgName}"`);
    console.log("");

    // Find max name length for alignment
    const maxName = Math.max(...agents.map((a) => a.name.length), 4);

    // Header
    const header = `  ${"NAME".padEnd(maxName + 2)}${"VENDOR".padEnd(12)}${"MODEL".padEnd(20)}${"STATUS".padEnd(10)}DEPARTMENT`;
    dim(header);

    for (const agent of agents) {
      const status = agent.status === "active" ? "\x1b[32mactive\x1b[0m" : agent.status;
      console.log(
        `  ${agent.name.padEnd(maxName + 2)}${(agent.vendor || "-").padEnd(12)}${(agent.model || "-").padEnd(20)}${(agent.status || "-").padEnd(10)}${agent.departmentName || "-"}`
      );
    }

    console.log("");
    dim(`  ${agents.length} agent(s) total`);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

/**
 * agent info [id] — Show agent details
 */
export async function agentInfoCommand(id) {
  const agentId = resolveAgentId(id);

  try {
    const res = await authApiCall(`/api/cli/agents/${agentId}`);
    if (!res.ok) {
      error(res.data?.error || "Failed to fetch agent");
      process.exit(1);
    }

    const a = res.data;

    heading(`Agent: ${a.name}`);
    console.log("");
    label("  ID", a.id);
    label("  Vendor", a.vendor);
    label("  Model", a.model);
    label("  Status", a.status);
    label("  Description", a.description || "-");
    label("  Department", a.departmentName);
    label("  Runtime", a.runtimeType || "api");
    label("  Last Active", a.lastActive || "-");
    label("  Created", a.createdAt || "-");
    label("  Monthly Cost", `$${a.monthlyCost ?? 0}`);
    label("  Tokens Used", String(a.tokensUsed ?? 0));

    if (a.skills?.length) {
      console.log("");
      heading("  Skills");
      for (const s of a.skills) {
        console.log(`    - ${s.name} (${s.category})`);
      }
    }

    if (a.mcpTools?.length) {
      console.log("");
      heading("  MCP Tools");
      for (const t of a.mcpTools) {
        const server = t.server ? ` [${t.server}]` : "";
        console.log(`    - ${t.name}${server}`);
      }
    }

    if (a.resources?.length) {
      console.log("");
      heading("  Resources");
      for (const r of a.resources) {
        console.log(`    - ${r.type}: ${r.name} (${r.url || "-"})`);
      }
    }

    if (a.context?.length) {
      console.log("");
      heading("  Context");
      for (const c of a.context) {
        const source = c.sourceFile ? ` (${c.sourceFile})` : "";
        const preview = c.content.length > 80 ? c.content.slice(0, 80) + "..." : c.content;
        console.log(`    - [${c.type}]${source} ${preview}`);
      }
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

/**
 * agent edit [id] — Edit agent properties
 */
export async function agentEditCommand(id, options) {
  const agentId = resolveAgentId(id);

  const updates = {};
  if (options.name) updates.name = options.name;
  if (options.vendor) updates.vendor = options.vendor;
  if (options.model) updates.model = options.model;
  if (options.description) updates.description = options.description;
  if (options.status) updates.status = options.status;

  if (Object.keys(updates).length === 0) {
    error("No fields to update. Use --name, --vendor, --model, --description, or --status.");
    process.exit(1);
  }

  try {
    const res = await authApiCall(`/api/cli/agents/${agentId}`, {
      method: "PATCH",
      body: updates,
    });

    if (!res.ok) {
      error(res.data?.error || "Failed to update agent");
      process.exit(1);
    }

    success(res.data.message || "Agent updated successfully");

    // Update local config if this is the local agent
    const local = readLocalConfig();
    if (local?.agentId === agentId) {
      if (updates.name) local.agentName = updates.name;
      if (updates.vendor) local.vendor = updates.vendor;
      if (updates.model) local.model = updates.model;
      writeLocalConfig(local);
      dim("  Local config updated.");
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

/**
 * agent pull [id] — Pull agent config from hub to local config
 */
export async function agentPullCommand(id) {
  const agentId = resolveAgentId(id);

  try {
    const res = await authApiCall(`/api/cli/agents/${agentId}`);
    if (!res.ok) {
      error(res.data?.error || "Failed to fetch agent");
      process.exit(1);
    }

    const a = res.data;
    const org = getDefaultOrg();

    writeLocalConfig({
      hubUrl: org.hubUrl,
      orgId: a.orgId,
      agentId: a.id,
      agentName: a.name,
      vendor: a.vendor,
      model: a.model,
      pushedAt: a.lastActive || new Date().toISOString(),
    });

    success(`Synced agent "${a.name}" to local config.`);
    label("  Agent", a.name);
    label("  Vendor", a.vendor);
    label("  Model", a.model);
    label("  Status", a.status);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

/**
 * agent delete [id] — Delete an agent
 */
export async function agentDeleteCommand(id) {
  const agentId = resolveAgentId(id);

  // Fetch agent name for confirmation
  try {
    const infoRes = await authApiCall(`/api/cli/agents/${agentId}`);
    const agentName = infoRes.ok ? infoRes.data.name : agentId;

    const confirmed = await confirm(`Delete agent "${agentName}"? This cannot be undone`, false);
    if (!confirmed) {
      info("Cancelled.");
      return;
    }

    const res = await authApiCall(`/api/cli/agents/${agentId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      error(res.data?.error || "Failed to delete agent");
      process.exit(1);
    }

    success(res.data.message || "Agent deleted successfully");

    // Remove local config if this is the local agent
    const local = readLocalConfig();
    if (local?.agentId === agentId) {
      const root = findProjectRoot();
      const configPath = path.join(root, ".agent-factorio", "config.json");
      try {
        fs.unlinkSync(configPath);
        dim("  Local config removed.");
      } catch {
        // ignore
      }
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}
