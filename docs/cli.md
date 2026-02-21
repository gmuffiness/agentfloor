# AgentFactorio CLI

`npx agent-factorio` — A CLI tool to register and manage agents on the hub from any project.

## Quick Start

```bash
# 1. Log in to the hub (email verification + create/join organization)
npx agent-factorio login

# 2. Register the current project's agent on the hub
npx agent-factorio push
```

After this, you can view the registered agent on the dashboard.

---

## Commands

### `agent-factorio login`

Connects to the hub, verifies your email, and joins an existing organization or creates a new one.

```
$ npx agent-factorio login
? AgentFactorio Hub URL [https://agent-factorio.vercel.app]:
✓ Hub connected.

? Your email (used as your identifier): alice@example.com
ℹ Sending verification email...
✓ Verification email sent!
ℹ Check your inbox and click the verification link.
  Waiting for verification...
✓ Email verified!

? Your name (displayed in the org) [CLI User]: Alice

? Create or join an organization?
  1. Create new
  2. Join existing (invite code)
Choice: 1

? Organization name: Acme Corp
✓ Created "Acme Corp" (org-12345)
ℹ Invite code: C2M2XF — share with your team!

Logged in! Run `agent-factorio push` in any project to register an agent.
```

**Behavior:**
1. Enter Hub URL (default: `https://agent-factorio.vercel.app`, enter manually for self-hosted instances)
2. Email verification (magic link)
3. Create an organization or join one via invite code
4. Auth token issued + saved to global config

**Multiple organizations:**
- Running `login` multiple times adds entries to the `organizations` array
- Use `org switch` to change the default organization

---

### `agent-factorio push`

Auto-detects the current project's agent configuration and registers it on the hub.

```
$ npx agent-factorio push

Detecting agent configuration...
  Git repo:     git@github.com:user/my-project.git
  Skills:       code-review, testing (2)
  MCP servers:  github, slack (2)
  CLAUDE.md:    found (.claude/CLAUDE.md)

? Agent name [my-project]: my-project
? Vendor
  1. anthropic
  2. openai
  3. google
Choice: 1
? Model
  1. claude-opus-4-6
  2. claude-sonnet-4-6
  3. claude-haiku-4-5-20251001
Choice: 1

ℹ Pushing to "Acme Corp" at https://agent-factorio.vercel.app...
✓ Agent registered! (agent-17345678)
```

**Auto-detected items:**

| Item | Source |
|------|------|
| Git repo URL | `git remote get-url origin` |
| Skills | `.claude/commands/*.md`, `.claude/skills/**/*.md`, `skills/**/*.md` |
| MCP servers | `mcpServers` in `.claude/settings.local.json`, `.claude/settings.json` |
| CLAUDE.md | `.claude/CLAUDE.md` or root `CLAUDE.md` |

**Updates:**
- If an agent is already registered (`agentId` exists in `.agent-factorio/config.json`), it automatically updates
- MCP tools and context (CLAUDE.md) are all refreshed
- No duplicate agents are created

---

### `agent-factorio status`

Checks the registration status of the current project.

```
$ npx agent-factorio status

Agent Status
  Agent ID:      agent-17345678
  Agent name:    my-project
  Vendor:        anthropic
  Model:         claude-opus-4-6
  Organization:  Acme Corp
  Hub URL:       https://agent-factorio.vercel.app
  Last pushed:   2026-02-19T11:51:00.000Z

✓ Agent is registered.
```

---

### `agent-factorio whoami`

Displays your login information.

```
$ npx agent-factorio whoami

Login Info

  Organization:  Acme Corp (default)
  Org ID:        org-12345
  Hub URL:       https://agent-factorio.vercel.app
  Invite code:   C2M2XF
  Member name:   Alice
```

---

### `agent-factorio logout`

Deletes the global config.

```
$ npx agent-factorio logout
✓ Logged out. Global config removed.
```

---

## Organization Commands

`agent-factorio org <subcommand>` — Create, join, list, and switch organizations.

### `org list`

Lists all organizations you belong to.

```
$ npx agent-factorio org list

Organizations

  Acme Corp (default)
    ID:           org-12345
    Role:         admin
    Invite Code:  C2M2XF
    Members:      5
    Agents:       12

  Side Project
    ID:           org-67890
    Role:         member
    Invite Code:  X9K4PL
    Members:      2
    Agents:       3
```

### `org create [name]`

Creates a new organization. Pass the name as an argument or enter it at the prompt.

```
$ npx agent-factorio org create "My Team"
✓ Created "My Team" (org-99999)
ℹ Invite code: H7J3KM — share with your team!
```

### `org join [inviteCode]`

Joins an existing organization using an invite code.

```
$ npx agent-factorio org join C2M2XF
✓ Joined "Acme Corp" (org-12345)
```

### `org switch`

Changes the default organization when you belong to multiple organizations.

```
$ npx agent-factorio org switch
? Select default organization
  1. Acme Corp (current)
  2. Side Project
Choice: 2
✓ Default organization set to "Side Project" (org-67890)
```

### `org info`

Displays detailed information about the current default organization.

```
$ npx agent-factorio org info

Organization

  Name:         Acme Corp
  ID:           org-12345
  Role:         admin
  Invite Code:  C2M2XF
  Members:      5
  Agents:       12
  Hub:          https://agent-factorio.vercel.app
```

---

## Agent Commands

`agent-factorio agent <subcommand>` — List, edit, sync, and delete agents.

If `[id]` is omitted in any command, the agent stored in the current project's `.agent-factorio/config.json` is used.

### `agent list`

Lists all agents in the current default organization.

```
$ npx agent-factorio agent list

Agents in "Acme Corp"

  NAME            VENDOR      MODEL               STATUS    DEPARTMENT
  my-project      anthropic   claude-opus-4-6     active    Engineering
  data-pipeline   openai      gpt-4o              active    Data
  chatbot         anthropic   claude-sonnet-4-6   idle      Support

  3 agent(s) total
```

### `agent info [id]`

Displays detailed agent information (including skills, MCP tools, context, and resources).

```
$ npx agent-factorio agent info

Agent: my-project

  ID:           agent-17345678
  Vendor:       anthropic
  Model:        claude-opus-4-6
  Status:       active
  Description:  Pushed via CLI
  Department:   Engineering
  Runtime:      api
  Last Active:  2026-02-21T10:30:00.000Z

  Skills
    - code-review (generation)
    - testing (generation)

  MCP Tools
    - github [github]
    - slack [slack]

  Resources
    - git_repo: user/my-project (git@github.com:user/my-project.git)
```

### `agent edit [id]`

Modifies agent properties. Specify fields to change via options.

```bash
# Change name and model
npx agent-factorio agent edit --name "my-agent-v2" --model "claude-sonnet-4-6"

# Specify a particular agent ID
npx agent-factorio agent edit agent-17345678 --vendor openai --model gpt-4o

# Available options
#   --name <name>         Agent name
#   --vendor <vendor>     Vendor (anthropic, openai, google, etc.)
#   --model <model>       Model
#   --description <desc>  Description
#   --status <status>     Status (active, idle, error)
```

When editing the local project's agent, `.agent-factorio/config.json` is automatically updated as well.

### `agent pull [id]`

Fetches agent configuration from the hub and syncs it to the local `.agent-factorio/config.json`.

```
$ npx agent-factorio agent pull
✓ Synced agent "my-project" to local config.
  Agent:   my-project
  Vendor:  anthropic
  Model:   claude-opus-4-6
  Status:  active
```

Use this when someone else has changed the agent settings from the dashboard and you want to reflect those changes locally.

### `agent delete [id]`

Deletes an agent. A confirmation prompt is shown.

```
$ npx agent-factorio agent delete
? Delete agent "my-project"? This cannot be undone [y/N]: y
✓ Agent "my-project" deleted successfully
  Local config removed.
```

---

## Config Files

### Global config: `~/.agent-factorio/config.json`

Created by the `login` command. Shared across all projects.

```json
{
  "organizations": [
    {
      "hubUrl": "https://agent-factorio.vercel.app",
      "orgId": "org-12345",
      "orgName": "Acme Corp",
      "inviteCode": "C2M2XF",
      "memberName": "Alice",
      "email": "alice@example.com",
      "memberId": "member-12345",
      "userId": "uuid-...",
      "authToken": "hex-token-..."
    }
  ],
  "defaultOrg": "org-12345"
}
```

- `authToken`: Issued on login. Used for authentication in `org` and `agent` commands
- `defaultOrg`: Can be changed with `org switch`

### Project config: `.agent-factorio/config.json`

Created by the `push` command. Applies only to the current project. **Recommended to add to .gitignore.**

```json
{
  "hubUrl": "https://agent-factorio.vercel.app",
  "orgId": "org-12345",
  "agentId": "agent-17345678",
  "agentName": "my-project",
  "vendor": "anthropic",
  "model": "claude-opus-4-6",
  "pushedAt": "2026-02-21T10:30:00.000Z"
}
```

---

## CLI API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/cli/login` | POST | None | Email verification, create/join organization. Issues authToken |
| `/api/cli/push` | POST | None | Register/update agent |
| `/api/cli/orgs` | GET | Bearer token | List organizations you belong to |
| `/api/cli/agents` | GET | Bearer token | List agents in organization (`?orgId=X`) |
| `/api/cli/agents/:id` | GET | Bearer token | Agent details |
| `/api/cli/agents/:id` | PATCH | Bearer token | Edit agent |
| `/api/cli/agents/:id` | DELETE | Bearer token | Delete agent |

Endpoints requiring authentication use the `Authorization: Bearer <authToken>` header.

---

## File Structure

```
cli/
  bin.js                   # Entry point
  commands/
    login.mjs              # login command
    push.mjs               # push command
    status.mjs             # status command
    whoami.mjs             # whoami command
    logout.mjs             # logout command
    connect.mjs            # connect command
    org.mjs                # org list/create/join/switch/info
    agent.mjs              # agent list/info/edit/pull/delete
  lib/
    config.mjs             # Global/local config read/write
    detect.mjs             # Auto-detect (git, skills, MCP, CLAUDE.md)
    api.mjs                # Hub API call helper (apiCall, authApiCall)
    prompt.mjs             # Interactive prompts (ask, choose, confirm)
    log.mjs                # Colored output utilities
```

---

## Troubleshooting

**`Cannot connect to hub`**
- Check that the hub is running (`pnpm dev` or the deployed URL)
- Verify the Hub URL is correct (include protocol: `http://` or `https://`)

**`Not logged in`**
- Run `agent-factorio login` first
- Check that `~/.agent-factorio/config.json` exists

**`Auth token missing`**
- If you logged in with a previous version, the token may not exist
- Running `agent-factorio login` again will issue a new token

**`No departments exist`**
- CLI push automatically creates an "Engineering" department if none exist

**`Invalid invite code`**
- Verify the invite code is correct (case-insensitive, 6 characters)
- Check that the organization exists on the hub

**`No agent ID specified`**
- `agent info`, `agent edit`, etc. use the agentId from local config when ID is omitted
- Run from the project root, or specify the ID directly: `agent info agent-12345`
