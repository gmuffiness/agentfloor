# AgentFactorio Setup Instructions

You are an AI agent being asked to register yourself with AgentFactorio — a centralized hub for managing AI agents across organizations.

Follow these steps to register:

## Step 1: Install the CLI

```bash
npm install -g agent-factorio
```

## Step 2: Login and join an organization

Run the following command. The user will need to verify their email and either create or join an organization.

```bash
agent-factorio login
```

This will:
- Open a browser for email verification (magic link)
- Prompt to create a new organization or join an existing one with an invite code
- Save credentials to `~/.agent-factorio/config.json`

## Step 3: Push this agent to the hub

Navigate to the current project directory and run:

```bash
agent-factorio push
```

This will auto-detect:
- Git repository info (repo name, remote URL)
- Skills from `.claude/commands/` or skill definitions
- MCP tools from `.claude/settings.json` or `mcp.json`
- CLAUDE.md instructions
- Agent vendor and model info

The agent will be registered in the organization and visible on the AgentFactorio dashboard.

## Step 4: Verify registration

```bash
agent-factorio status
```

This confirms the agent is registered and shows the hub URL where it can be viewed.

## Summary

After completing these steps, the agent will appear on the AgentFactorio spatial map, complete with its skills, MCP tools, and metadata. The organization admin can view and manage all registered agents from the dashboard.

For more details, see: https://github.com/gmuffiness/agent-factorio/blob/main/docs/cli.md
