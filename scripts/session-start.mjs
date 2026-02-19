#!/usr/bin/env node
/**
 * AgentFloor session-start hook
 * Runs when a Claude Code session starts.
 * Checks for .agentfloor/config.json and displays connection status.
 */
import fs from "fs";
import path from "path";

const CONFIG_DIR = ".agentfloor";
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// --- Inline detection helpers (self-contained, no external imports) ---

function detectMcpServers(projectRoot) {
  const servers = new Set();
  for (const filename of ["settings.local.json", "settings.json"]) {
    const settingsPath = path.join(projectRoot, ".claude", filename);
    try {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      const settings = JSON.parse(raw);
      if (settings.mcpServers && typeof settings.mcpServers === "object") {
        for (const name of Object.keys(settings.mcpServers)) {
          servers.add(name);
        }
      }
    } catch {
      // file not found or invalid JSON
    }
  }
  return [...servers];
}

function detectClaudeMd(projectRoot) {
  for (const relPath of [".claude/CLAUDE.md", "CLAUDE.md"]) {
    const fullPath = path.join(projectRoot, relPath);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      return { found: true, path: relPath, content };
    } catch {
      // not found
    }
  }
  return { found: false, path: null, content: null };
}

async function autoPush(config, projectRoot) {
  const mcpServers = detectMcpServers(projectRoot);
  const claudeMd = detectClaudeMd(projectRoot);

  const body = {
    agentId: config.agentId,
    agentName: config.agentName,
    vendor: config.vendor,
    model: config.model,
    orgId: config.orgId,
    description: `Auto-pushed via session-start hook at ${new Date().toISOString()}`,
  };

  if (mcpServers.length > 0) {
    body.mcpTools = mcpServers.map((name) => ({ name, server: name }));
  }

  if (claudeMd.found) {
    body.context = [{
      type: "claude_md",
      content: claudeMd.content,
      sourceFile: claudeMd.path,
    }];
  }

  try {
    const res = await fetch(`${config.hubUrl}/api/cli/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      process.stderr.write(`[AgentFloor] Auto-push complete: ${data?.message ?? "OK"}\n`);
    } else {
      process.stderr.write(`[AgentFloor] Auto-push failed: ${data?.error ?? res.status}\n`);
    }
  } catch (err) {
    process.stderr.write(`[AgentFloor] Auto-push failed: ${err.message}\n`);
  }
}

// ---

function main() {
  // Check if config exists
  if (!fs.existsSync(CONFIG_FILE)) {
    process.stderr.write(
      "[AgentFloor] Not configured. Run /agentfloor:setup to connect to your monitoring hub.\n"
    );
    return;
  }

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    const hubUrl = config.hubUrl || "unknown";
    const agentName = config.agentName || "unknown";
    const orgName = config.orgName || "unknown";

    process.stderr.write(
      `[AgentFloor] Connected to ${hubUrl} | Org: ${orgName} | Agent: ${agentName}\n`
    );

    // Heartbeat: notify hub that this agent is active
    if (config.hubUrl && config.agentId) {
      fetch(`${config.hubUrl}/api/agents/${config.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      }).catch(() => {
        // Silently ignore heartbeat failures
      });

      // Fetch unread announcements
      fetch(`${config.hubUrl}/api/cli/announcements?agentId=${config.agentId}`)
        .then((res) => res.json())
        .then(async ({ announcements }) => {
          if (!announcements?.length) return;

          const pushRequests = announcements.filter((a) => a.title === "[push-request]");
          const regular = announcements.filter((a) => a.title !== "[push-request]");

          // Handle push requests: auto-trigger push
          if (pushRequests.length > 0) {
            const msg = pushRequests[0].content;
            process.stderr.write(
              `\n[AgentFloor] Push requested by admin: ${msg}\n`
            );
            process.stderr.write(`[AgentFloor] Auto-pushing agent config...\n`);
            await autoPush(config, process.cwd());
          }

          // Show regular announcements
          if (regular.length > 0) {
            process.stderr.write(
              `\n[AgentFloor] ${regular.length}개의 새 공지사항:\n`
            );
            for (const a of regular) {
              const prefix = a.priority === "urgent" ? "[urgent]" : "[info]";
              process.stderr.write(`  ${prefix} ${a.title}: ${a.content}\n`);
            }
          }

          // Auto-ack all announcements (including push requests)
          fetch(`${config.hubUrl}/api/cli/announcements/ack`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId: config.agentId,
              announcementIds: announcements.map((a) => a.id),
            }),
          }).catch(() => {});
        })
        .catch(() => {
          // Silently ignore announcement fetch failures
        });
    }
  } catch {
    process.stderr.write("[AgentFloor] Config file corrupted. Run /agentfloor:setup to reconfigure.\n");
  }
}

main();
