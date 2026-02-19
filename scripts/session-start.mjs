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
    }
  } catch {
    process.stderr.write("[AgentFloor] Config file corrupted. Run /agentfloor:setup to reconfigure.\n");
  }
}

main();
