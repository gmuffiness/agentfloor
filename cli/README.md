# agentfloor

CLI for [AgentFloor](https://github.com/your-org/agentfloor) — AI Agent Fleet Management hub.

Register and manage your AI agents from any project.

## Install

```bash
npm install -g agentfloor
```

Or use directly with `npx`:

```bash
npx agentfloor <command>
```

## Commands

### `agentfloor login`

Connect to an AgentFloor hub and join an organization.

```bash
npx agentfloor login
```

Prompts for hub URL and email, then lets you create or join an organization via invite code.

### `agentfloor push`

Detect and push agent configuration to the hub.

```bash
npx agentfloor push
```

Auto-detects git repo, CLAUDE.md, MCP servers, skills, and plugins from the current project directory.

### `agentfloor status`

Show registration status for the current project.

```bash
npx agentfloor status
```

### `agentfloor whoami`

Show login info (hub URL, organizations).

```bash
npx agentfloor whoami
```

### `agentfloor logout`

Remove global config and log out.

```bash
npx agentfloor logout
```

## Configuration

- Global config: `~/.agentfloor/config.json` (hub URL, member ID, organizations)
- Project config: `.agentfloor/config.json` (agent ID, hub URL — gitignored)

## Requirements

- Node.js >= 18
