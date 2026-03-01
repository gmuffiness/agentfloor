#!/usr/bin/env node
/**
 * AgentFactorio file watcher
 * Monitors config-related files and auto-pushes changes to the hub.
 * Spawned by session-start.mjs — lifecycle tied to the Claude Code session.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const PROJECT_ROOT = process.env.AF_PROJECT_ROOT || process.cwd();
const CONFIG_DIR = ".agent-factorio";
const CONFIG_FILE = path.join(PROJECT_ROOT, CONFIG_DIR, "config.json");
const DEBOUNCE_MS = 3 * 60 * 1000; // 3 minutes

// --- Config ---

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
} catch {
  process.stderr.write("[AgentFactorio:watcher] No config found. Exiting.\n");
  process.exit(0);
}

if (!config.hubUrl || !config.agentId) {
  process.stderr.write("[AgentFactorio:watcher] Missing hubUrl or agentId. Exiting.\n");
  process.exit(0);
}

// --- PID file (prevent duplicate watchers) ---

const PID_FILE = path.join("/tmp", `af-watcher-${config.agentId}.pid`);

try {
  if (fs.existsSync(PID_FILE)) {
    const existingPid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
    try {
      process.kill(existingPid, 0); // check if alive
      process.stderr.write(`[AgentFactorio:watcher] Already running (PID ${existingPid}). Exiting.\n`);
      process.exit(0);
    } catch {
      // process not alive, stale PID file — continue
    }
  }
} catch {
  // PID file read error — continue
}

fs.writeFileSync(PID_FILE, String(process.pid));

// --- Inline detection helpers (same as session-start.mjs) ---

function detectMcpServers() {
  const servers = new Set();
  for (const filename of ["settings.local.json", "settings.json"]) {
    const settingsPath = path.join(PROJECT_ROOT, ".claude", filename);
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

function detectClaudeMd() {
  for (const relPath of [".claude/CLAUDE.md", "CLAUDE.md"]) {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      return { found: true, path: relPath, content };
    } catch {
      // not found
    }
  }
  return { found: false, path: null, content: null };
}

async function autoPush() {
  const mcpServers = detectMcpServers();
  const claudeMd = detectClaudeMd();

  const body = {
    agentId: config.agentId,
    agentName: config.agentName,
    vendor: config.vendor,
    model: config.model,
    orgId: config.orgId,
    description: `Auto-pushed via file watcher at ${new Date().toISOString()}`,
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
      process.stderr.write(`[AgentFactorio:watcher] Auto-push complete: ${data?.message ?? "OK"}\n`);
    } else {
      process.stderr.write(`[AgentFactorio:watcher] Auto-push failed: ${data?.error ?? res.status}\n`);
    }
  } catch (err) {
    process.stderr.write(`[AgentFactorio:watcher] Auto-push failed: ${err.message}\n`);
  }
}

// --- File watching ---

const WATCH_TARGETS = [
  { path: ".claude/commands", recursive: true },
  { path: ".claude/skills", recursive: true },
  { path: ".claude/settings.json", recursive: false },
  { path: ".claude/settings.local.json", recursive: false },
  { path: ".claude/CLAUDE.md", recursive: false },
  { path: "CLAUDE.md", recursive: false },
];

let debounceTimer = null;
const watchers = [];

function onFileChange(targetPath, eventType, filename) {
  process.stderr.write(
    `[AgentFactorio:watcher] Change detected: ${targetPath}${filename ? "/" + filename : ""} (${eventType})\n`
  );

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    process.stderr.write("[AgentFactorio:watcher] Debounce expired. Pushing changes...\n");
    await autoPush();
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

for (const target of WATCH_TARGETS) {
  const fullPath = path.join(PROJECT_ROOT, target.path);

  try {
    const stat = fs.statSync(fullPath);
    const isDir = stat.isDirectory();

    const watcher = fs.watch(
      fullPath,
      { recursive: isDir && target.recursive },
      (eventType, filename) => onFileChange(target.path, eventType, filename)
    );

    watcher.on("error", (err) => {
      process.stderr.write(`[AgentFactorio:watcher] Watch error on ${target.path}: ${err.message}\n`);
    });

    watchers.push(watcher);
  } catch {
    // Path doesn't exist yet — skip silently
  }
}

if (watchers.length === 0) {
  process.stderr.write("[AgentFactorio:watcher] No watchable paths found. Exiting.\n");
  cleanup();
  process.exit(0);
}

process.stderr.write(
  `[AgentFactorio:watcher] Watching ${watchers.length} target(s) for changes (PID ${process.pid})\n`
);

// --- Graceful shutdown ---

function setIdleStatus() {
  try {
    execSync(
      `curl -s -X PATCH "${config.hubUrl}/api/agents/${config.agentId}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '{"status":"idle"}'`,
      { timeout: 5000, stdio: "ignore" }
    );
    process.stderr.write("[AgentFactorio:watcher] Agent status set to idle.\n");
  } catch {
    // best-effort — don't block shutdown
  }
}

function cleanup() {
  for (const w of watchers) {
    try { w.close(); } catch { /* ignore */ }
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
}

process.on("SIGINT", () => {
  process.stderr.write("[AgentFactorio:watcher] Received SIGINT. Shutting down.\n");
  setIdleStatus();
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.stderr.write("[AgentFactorio:watcher] Received SIGTERM. Shutting down.\n");
  setIdleStatus();
  cleanup();
  process.exit(0);
});

process.on("exit", () => {
  cleanup();
});
