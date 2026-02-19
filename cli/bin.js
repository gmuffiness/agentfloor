#!/usr/bin/env node

/**
 * AgentFloor CLI — register and manage agents from any project
 *
 * Usage:
 *   npx agentfloor login     # Connect to hub + join organization
 *   npx agentfloor push      # Push agent config to hub
 *   npx agentfloor status    # Show registration status
 *   npx agentfloor whoami    # Show login info
 *   npx agentfloor logout    # Remove global config
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));

const program = new Command();

program
  .name("agentfloor")
  .description("AgentFloor CLI — AI Agent Fleet Management")
  .version(pkg.version);

program
  .command("login")
  .description("Connect to an AgentFloor hub and join an organization")
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

program.parse();
