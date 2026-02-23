#!/usr/bin/env node

/**
 * AgentFactorio CLI — register and manage agents from any project
 *
 * Usage:
 *   npx agent-factorio login          # Connect to hub + join organization
 *   npx agent-factorio push           # Push agent config to hub
 *   npx agent-factorio status         # Show registration status
 *   npx agent-factorio whoami         # Show login info
 *   npx agent-factorio logout         # Remove global config
 *   npx agent-factorio connect        # Poll hub and relay messages
 *
 *   npx agent-factorio org list       # List organizations
 *   npx agent-factorio org create     # Create a new organization
 *   npx agent-factorio org join       # Join via invite code
 *   npx agent-factorio org switch     # Change default organization
 *   npx agent-factorio org info       # Show current org details
 *
 *   npx agent-factorio agent list     # List agents in current org
 *   npx agent-factorio agent info     # Show agent details
 *   npx agent-factorio agent edit     # Edit agent properties
 *   npx agent-factorio agent pull     # Sync hub config to local
 *   npx agent-factorio agent delete   # Delete an agent
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Command } from "commander";
import { loginCommand } from "./commands/login.mjs";
import { pushCommand } from "./commands/push.mjs";
import { statusCommand } from "./commands/status.mjs";
import { whoamiCommand } from "./commands/whoami.mjs";
import { logoutCommand } from "./commands/logout.mjs";
import { connectCommand } from "./commands/connect.mjs";
import {
  orgListCommand,
  orgCreateCommand,
  orgJoinCommand,
  orgSwitchCommand,
  orgInfoCommand,
} from "./commands/org.mjs";
import {
  agentListCommand,
  agentInfoCommand,
  agentEditCommand,
  agentPullCommand,
  agentDeleteCommand,
} from "./commands/agent.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));

const program = new Command();

program
  .name("agent-factorio")
  .description("AgentFactorio CLI — AI Agent Fleet Management")
  .version(pkg.version);

// --- Existing top-level commands ---

program
  .command("login")
  .description("Connect to an AgentFactorio hub and join an organization")
  .option("--hub-url <url>", "Hub URL (default: https://agent-factorio.vercel.app)")
  .action(loginCommand);

program
  .command("push")
  .description("Detect and push agent configuration to the hub")
  .action(pushCommand);

program
  .command("status")
  .description("Show registration status for the current project")
  .action(statusCommand);

program
  .command("whoami")
  .description("Show login info (hub URL, organizations)")
  .action(whoamiCommand);

program
  .command("logout")
  .description("Remove global config and log out")
  .action(logoutCommand);

program
  .command("connect")
  .description("Poll hub and relay messages to local OpenClaw Gateway")
  .action(connectCommand);

// --- org subcommands ---

const org = program
  .command("org")
  .description("Manage organizations");

org
  .command("list")
  .description("List all organizations you belong to")
  .action(orgListCommand);

org
  .command("create")
  .description("Create a new organization")
  .argument("[name]", "Organization name")
  .action(orgCreateCommand);

org
  .command("join")
  .description("Join an organization via invite code")
  .argument("[inviteCode]", "Invite code")
  .action(orgJoinCommand);

org
  .command("switch")
  .description("Change the default organization")
  .action(orgSwitchCommand);

org
  .command("info")
  .description("Show details about the current organization")
  .action(orgInfoCommand);

// --- agent subcommands ---

const agent = program
  .command("agent")
  .description("Manage agents");

agent
  .command("list")
  .description("List all agents in the current organization")
  .action(agentListCommand);

agent
  .command("info")
  .description("Show agent details")
  .argument("[id]", "Agent ID (defaults to local project agent)")
  .action(agentInfoCommand);

agent
  .command("edit")
  .description("Edit agent properties")
  .argument("[id]", "Agent ID (defaults to local project agent)")
  .option("--name <name>", "Agent name")
  .option("--vendor <vendor>", "Vendor (e.g. anthropic, openai)")
  .option("--model <model>", "Model (e.g. claude-sonnet-4-20250514)")
  .option("--description <desc>", "Description")
  .option("--status <status>", "Status (active, idle, error)")
  .action(agentEditCommand);

agent
  .command("pull")
  .description("Sync agent config from hub to local project")
  .argument("[id]", "Agent ID (defaults to local project agent)")
  .action(agentPullCommand);

agent
  .command("delete")
  .description("Delete an agent")
  .argument("[id]", "Agent ID (defaults to local project agent)")
  .action(agentDeleteCommand);

program.parse();
