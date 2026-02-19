# AgentFloor Setup Wizard

You are running the AgentFloor setup wizard. This registers the current project's Claude Code agent to an AgentFloor monitoring hub.

## Auto-Detection (do this FIRST, silently before any questions)

1. **Git repo**: Run `git remote get-url origin` via Bash to get the repo URL. Run `basename $(git rev-parse --show-toplevel)` to get the project name.
2. **Skills**: Use Glob to find `.claude/commands/*.md` and `.claude/skills/**/*.md` files. Read each file's first heading to get the skill name.
3. **MCP servers**: Read `.claude/settings.local.json` and `.claude/settings.json` if they exist. Extract keys from `mcpServers` object.
4. **Existing config**: Check if `.agentfloor/config.json` exists. If so, read it — this determines whether this is a first-time or returning setup.
5. **Global config**: Check if `~/.agentfloor/config.json` exists. This stores the hub URL and known organizations from previous setups on this machine.

## Flow: First-Time Setup (no global config)

If `~/.agentfloor/config.json` does NOT exist, run the full onboarding:

### Step 1: Hub URL

Ask for the AgentFloor hub URL:
- `http://localhost:3000` (local development)
- A deployed URL (user types it)

### Step 2: Verify Hub Connection

Run via Bash: `curl -sf {hubUrl}/api/organizations`
- Success → "Hub connected."
- Failure → warn and ask to fix URL or continue anyway.

### Step 3: Organization

Ask the user:
- **Create new organization**: Ask for org name. Call:
  ```bash
  curl -s -X POST {hubUrl}/api/organizations -H "Content-Type: application/json" -d '{"name":"<name>","createdBy":"<agentName>"}'
  ```
  Show the invite code. Tell the user to share this code with teammates.

- **Join existing organization**: Ask for 6-digit invite code. Call:
  ```bash
  curl -s -X POST {hubUrl}/api/organizations/join -H "Content-Type: application/json" -d '{"inviteCode":"<code>","memberName":"<userName>"}'
  ```

Store `orgId`, `orgName`, and `inviteCode` from the response.

### Step 4: Save Global Config

Save to `~/.agentfloor/config.json` (create `~/.agentfloor/` with `mkdir -p`):
```json
{
  "hubUrl": "<url>",
  "organizations": [
    {
      "id": "<orgId>",
      "name": "<orgName>",
      "inviteCode": "<inviteCode>",
      "joinedAt": "<ISO timestamp>"
    }
  ],
  "defaultOrgId": "<orgId>"
}
```

Then continue to **Agent Registration** (Step A below).

---

## Flow: Returning Setup (global config exists)

If `~/.agentfloor/config.json` EXISTS, skip hub/org setup and offer a streamlined flow:

### Step R1: Show Current Context

Read `~/.agentfloor/config.json` and display:
```
AgentFloor Hub: {hubUrl}
Known organizations:
  1. {orgName1} (invite: {code1})
  2. {orgName2} (invite: {code2})
```

### Step R2: Choose Action

Ask the user:
- **Add agent to existing organization**: Show list of known orgs, let user pick one
- **Join another organization**: Ask for invite code, call join API, add to global config
- **Create new organization**: Ask for name, call create API, add to global config

After org is selected/created, continue to **Agent Registration** (Step A below).

---

## Agent Registration (shared flow)

### Step A: Agent Name

Ask for this agent's display name.
- Default: project directory name detected earlier (e.g., `cosmax-explorer-api`)
- If `.agentfloor/config.json` exists in this project, show the previous name

### Step B: Department

Fetch departments: `curl -s {hubUrl}/api/departments`

Let the user:
- Choose an existing department
- Create a new one (provide a name)

### Step C: Vendor & Model

Ask:
- **Vendor**: anthropic, openai, google
- **Model** suggestions:
  - anthropic: claude-opus-4-6, claude-sonnet-4-5-20250929
  - openai: gpt-4o, o3
  - google: gemini-2.5-pro, gemini-2.5-flash

### Step D: Review Auto-Detected Info

Show what was detected:
```
Detected project info:
  Git repo:    {gitRepoUrl}
  Skills:      {list of skill names}
  MCP servers: {list of MCP server names}
```

Ask if they want to register all of these, or customize.

### Step E: Register Agent

Call via Bash:
```bash
curl -s -X POST {hubUrl}/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "<name>",
    "vendor": "<vendor>",
    "model": "<model>",
    "departmentId": "<deptId>",
    "departmentName": "<newDeptName if creating>",
    "orgId": "<orgId>",
    "description": "Project: <gitRepoUrl>",
    "skills": [<detected skill names as strings>],
    "mcpTools": [<detected MCP servers as {"name":"x","server":"x"}>],
    "resources": [{"type":"git_repo","name":"<repo-name>","url":"<gitRepoUrl>","accessLevel":"write"}]
  }'
```

### Step F: Save Project Config

Write `.agentfloor/config.json` in the current project (create dir with `mkdir -p .agentfloor`):
```json
{
  "hubUrl": "<url>",
  "orgId": "<orgId>",
  "orgName": "<orgName>",
  "agentId": "<returned agent id>",
  "agentName": "<name>",
  "departmentId": "<deptId>",
  "vendor": "<vendor>",
  "model": "<model>",
  "gitRepo": "<gitRepoUrl>",
  "registeredAt": "<ISO timestamp>"
}
```

### Step G: Summary

Display:
```
AgentFloor Setup Complete!

  Hub:        {hubUrl}
  Org:        {orgName}
  Agent:      {agentName} ({vendor}/{model})
  Department: {deptName}
  Agent ID:   {agentId}
  Git Repo:   {gitRepoUrl}
  Skills:     {count} registered
  MCP Tools:  {count} registered

Dashboard: {hubUrl}
```

Tell the user:
- Run `/agentfloor-setup` again anytime to reconfigure or register to a different org
- Share the invite code `{inviteCode}` with teammates so they can join the same org
