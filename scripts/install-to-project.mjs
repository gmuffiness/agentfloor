#!/usr/bin/env node
/**
 * Install AgentFloor plugin into any Claude Code project.
 *
 * Usage:
 *   node /path/to/agentfloor/scripts/install-to-project.mjs [target-dir]
 *
 * If target-dir is omitted, installs into the current working directory.
 *
 * What it does:
 *   1. Creates .claude/commands/agentfloor-setup.md (the /agentfloor:setup command)
 *   2. Adds .agentfloor/ to .gitignore
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = process.argv[2] || process.cwd();

const SKILL_SOURCE = path.join(__dirname, "..", "skills", "setup", "SKILL.md");
const COMMAND_DIR = path.join(targetDir, ".claude", "commands");
const COMMAND_FILE = path.join(COMMAND_DIR, "agentfloor-setup.md");
const GITIGNORE = path.join(targetDir, ".gitignore");

function main() {
  // 1. Copy skill file as a Claude Code command
  if (!fs.existsSync(SKILL_SOURCE)) {
    console.error("ERROR: SKILL.md not found at", SKILL_SOURCE);
    process.exit(1);
  }

  fs.mkdirSync(COMMAND_DIR, { recursive: true });
  fs.copyFileSync(SKILL_SOURCE, COMMAND_FILE);
  console.log(`✓ Installed /agentfloor:setup command → ${COMMAND_FILE}`);

  // 2. Add .agentfloor/ to .gitignore
  if (fs.existsSync(GITIGNORE)) {
    const content = fs.readFileSync(GITIGNORE, "utf-8");
    if (!content.includes(".agentfloor/")) {
      fs.appendFileSync(GITIGNORE, "\n# AgentFloor local config\n.agentfloor/\n");
      console.log("✓ Added .agentfloor/ to .gitignore");
    } else {
      console.log("✓ .agentfloor/ already in .gitignore");
    }
  } else {
    fs.writeFileSync(GITIGNORE, "# AgentFloor local config\n.agentfloor/\n");
    console.log("✓ Created .gitignore with .agentfloor/");
  }

  console.log("\nDone! Now open Claude Code in this project and run:");
  console.log("  /agentfloor-setup");
}

main();
