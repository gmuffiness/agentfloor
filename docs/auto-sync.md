# Auto-Sync (File Watcher)

AgentFactorio can automatically detect changes to your agent configuration files and push updates to the hub — no manual `agent-factorio push` needed.

## How It Works

1. When a Claude Code session starts, the **session-start hook** spawns a background file watcher process
2. The watcher monitors configuration files (skills, MCP settings, CLAUDE.md) for changes
3. When a change is detected, it waits **3 minutes** (debounce) to batch rapid edits
4. After the debounce period, it automatically pushes the latest config to the hub
5. When the Claude Code session ends, the watcher process terminates with it

## Watched Files

| Path | What It Tracks |
|------|---------------|
| `.claude/commands/*.md` | Skill files (slash commands) |
| `.claude/skills/` | Skill definitions |
| `.claude/settings.json` | MCP server configuration |
| `.claude/settings.local.json` | Local MCP server configuration |
| `.claude/CLAUDE.md` | Project-level instructions |
| `CLAUDE.md` | Root-level project instructions |

## Debounce Strategy

The watcher uses a 3-minute debounce to avoid excessive pushes during active editing:

- **First change** → starts a 3-minute timer
- **Subsequent changes** → resets the timer back to 3 minutes
- **Timer expires** → pushes all accumulated changes in one request
- **Result**: only one push occurs after a burst of edits

## Lifecycle

The watcher is **session-scoped** — it lives and dies with your Claude Code session:

- **Start**: automatically spawned by `session-start.mjs` when a session begins
- **Run**: stays alive in the background, watching for file changes
- **Stop**: terminates when the Claude Code session ends (child process of the session)

No daemon, no background service, no cleanup needed.

## Duplicate Prevention

A PID file (`/tmp/af-watcher-{agentId}.pid`) prevents multiple watchers from running simultaneously. If a watcher is already running for the same agent, new spawn attempts are silently skipped.

## Logs

All watcher logs are written to `stderr` with the `[AgentFactorio:watcher]` prefix:

```
[AgentFactorio:watcher] Watching 4 target(s) for changes (PID 12345)
[AgentFactorio:watcher] Change detected: .claude/commands/test.md (change)
[AgentFactorio:watcher] Debounce expired. Pushing changes...
[AgentFactorio:watcher] Auto-push complete: OK
```

## Disabling Auto-Sync

Auto-sync is enabled by default when `.agent-factorio/config.json` exists. To disable it:

1. Remove the config file: `rm .agent-factorio/config.json`
2. Or disconnect: `agent-factorio logout`

The watcher will exit immediately if no valid config is found.
