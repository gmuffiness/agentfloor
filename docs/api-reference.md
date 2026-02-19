# API Reference

All endpoints are Next.js Route Handlers under `src/app/api/`. Data is stored in Supabase (PostgreSQL).

## Organizations

### `GET /api/organizations`
List all organizations.

**Response:** `Organization[]`

### `POST /api/organizations`
Create a new organization with auto-generated invite code.

**Body:**
```json
{
  "name": "My Org",
  "budget": 10000,
  "createdBy": "admin-name"
}
```

**Response:** `{ "id", "name", "inviteCode" }`

### `POST /api/organizations/join`
Join an organization using an invite code.

**Body:**
```json
{
  "inviteCode": "ABC123",
  "memberName": "developer-name"
}
```

**Response:** `{ "orgId", "orgName", "role" }`

## Organization Tree

### `GET /api/organization`
Returns the full organization tree with nested departments, agents, skills, tools, plugins, and history.

**Response:** `Organization` (see data model)

## Departments

### `GET /api/departments`
List all departments with agent counts.

### `POST /api/departments`
Create a new department.

**Body:**
```json
{
  "name": "Engineering",
  "description": "...",
  "budget": 5000,
  "primaryVendor": "anthropic"
}
```

### `PATCH /api/departments/[id]`
Update a department (name, description, budget, primaryVendor).

### `DELETE /api/departments/[id]`
Delete a department. Fails if department has agents.

## Agents

### `GET /api/agents`
List all agents with department info. Supports query filters: `?dept=`, `?vendor=`, `?status=`.

### `POST /api/agents`
Create a new agent with optional skills, plugins, and MCP tools.

### `PATCH /api/agents/[id]`
Update an agent (name, status, vendor, model, monthlyCost, deptId, skillIds).

### `DELETE /api/agents/[id]`
Delete an agent. Cascades to skills, plugins, MCP tools.

## Agent Registration

### `POST /api/register`
Self-registration endpoint for agents to join the fleet. Used by the `/agentfloor:setup` wizard.

**Body:**
```json
{
  "agentName": "my-agent",
  "vendor": "anthropic",
  "model": "claude-opus-4-6",
  "orgId": "org-123",
  "departmentId": "dept-456",
  "departmentName": "New Dept (if creating)",
  "description": "...",
  "skills": ["Code Generation", "Code Review"],
  "plugins": ["plugin-name"],
  "mcpTools": [{ "name": "filesystem", "server": "filesystem" }]
}
```

**Response:** `{ "id", "departmentId", "organizationId", "message" }`

## Graph

### `GET /api/graph`
Returns pre-computed React Flow nodes and edges from live Supabase data.

**Response:**
```json
{
  "nodes": [
    {
      "id": "dept-{id}",
      "type": "department" | "agent" | "skill" | "mcp_tool" | "plugin",
      "position": { "x": number, "y": number },
      "data": { ... }
    }
  ],
  "edges": [
    {
      "id": "e-...",
      "source": "agent-{id}",
      "target": "dept-{id}" | "skill-{id}" | "mcp-{id}" | "plugin-{id}",
      "data": { "relationship": "belongs-to" | "has-skill" | "uses-tool" | "uses-plugin" }
    }
  ]
}
```

**Node types:**
- `department` — name, agentCount, budget, monthlySpend, vendor
- `agent` — name, vendor, model, status, monthlyCost, agentId
- `skill` — name, icon, category
- `mcp_tool` — name, icon, category, server
- `plugin` — name, icon, version
