# Data Model

## Entity Hierarchy

```
Organization (invite code for team access)
  ├── OrgMember[]         (admin/member roles)
  └── Department[]
        └── Agent[]
              ├── Skill[]        (many-to-many via agent_skills)
              ├── Plugin[]       (one-to-many)
              └── McpTool[]      (one-to-many)
```

## Types (`src/types/index.ts`)

### Enums

| Type | Values |
|---|---|
| `Vendor` | `"anthropic"` \| `"openai"` \| `"google"` |
| `AgentStatus` | `"active"` \| `"idle"` \| `"error"` |
| `SkillCategory` | `"generation"` \| `"review"` \| `"testing"` \| `"documentation"` \| `"debugging"` \| `"deployment"` |
| MCP `category` | `"filesystem"` \| `"database"` \| `"api"` \| `"browser"` \| `"communication"` \| `"devtools"` |
| `OrgMemberRole` | `"admin"` \| `"member"` |
| `OrgMemberStatus` | `"active"` \| `"pending"` |

### Core Entities

- **Organization** — `id`, `name`, `totalBudget`, `inviteCode`, `createdBy`, `departments[]`
- **OrgMember** — `id`, `orgId`, `name`, `role`, `status`, `joinedAt`
- **Department** — `id`, `name`, `description`, `budget`, `monthlySpend`, `layout{x,y,width,height}`, `primaryVendor`, `agents[]`, `costHistory[]`
- **Agent** — `id`, `name`, `description`, `vendor`, `model`, `status`, `monthlyCost`, `tokensUsed`, `position{x,y}`, `skills[]`, `plugins[]`, `mcpTools[]`, `usageHistory[]`, `lastActive`, `createdAt`
- **Skill** — `id`, `name`, `category`, `icon`, `description`
- **Plugin** — `id`, `name`, `icon`, `description`, `version`, `enabled`
- **McpTool** — `id`, `name`, `server`, `icon`, `description`, `category`

### History

- **DailyUsage** — `date`, `tokens`, `cost`, `requests` (per agent, 7 days)
- **MonthlyCost** — `month`, `amount`, `byVendor: Record<Vendor, number>` (per department, 6 months)

## Database Schema (Supabase PostgreSQL)

Schema defined in `supabase/migrations/001_init.sql`.

| Table | Notes |
|---|---|
| `organizations` | Root entity, `invite_code` (unique 6-char), `created_by` |
| `org_members` | FK → organizations, `role` (admin/member), `status` (active/pending) |
| `departments` | FK → organizations, includes layout columns (x, y, w, h) |
| `agents` | FK → departments, includes position columns (pos_x, pos_y) |
| `skills` | Standalone skill definitions |
| `agent_skills` | Many-to-many junction (agent_id, skill_id) |
| `plugins` | FK → agents (one-to-many) |
| `mcp_tools` | FK → agents (one-to-many) |
| `cost_history` | FK → departments, vendor cost columns (anthropic, openai, google) |
| `usage_history` | FK → agents, daily metrics |

All tables have RLS enabled. Server-side access uses the Supabase service role key which bypasses RLS.

## Organization & Agent Registration Flow

1. **Create Organization**: `POST /api/organizations` → generates 6-char invite code
2. **Join Organization**: `POST /api/organizations/join` → use invite code to join
3. **Register Agent**: `POST /api/register` → links agent to org + department, records vendor/model/MCP tools
4. **Session Heartbeat**: On each session start, agent status is set to `active`
