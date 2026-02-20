# Architecture

## Overview

AgentFloor is **"GitHub for AI Agents"** — an enterprise agent registry that centralizes the configuration, status, and relationships of distributed AI agents into a single source of truth. Just as GitHub manages code repositories across an organization, AgentFloor manages agent fleets: what each agent can do (skills, MCP tools), who registered it, which department it belongs to, and whether it's currently active.

Individual developers run `npx agentfloor push` from their projects, and their Claude Code agents register to a shared organization. The hub visualizes all agents across the organization in a Gather.town-style spatial dashboard.

See [docs/vision.md](vision.md) for service positioning and competitive landscape.

### How It Works

```
Developer A                    Developer B                    Developer C
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│ Claude Code  │              │ Claude Code  │              │ Claude Code  │
│ + AgentFloor │              │ + AgentFloor │              │ + AgentFloor │
│   plugin     │              │   plugin     │              │   plugin     │
└──────┬───────┘              └──────┬───────┘              └──────┬───────┘
       │                             │                             │
       │  /agentfloor:setup          │  /agentfloor:setup          │  /agentfloor:setup
       │  (create org or             │  (join via                  │  (join via
       │   invite code)              │   invite code)              │   invite code)
       │                             │                             │
       └─────────────┬───────────────┴─────────────┬───────────────┘
                     │                             │
                     ▼                             ▼
              ┌─────────────────────────────────────────┐
              │         AgentFloor Hub (Next.js)         │
              │  ┌─────────────────────────────────────┐ │
              │  │     Supabase (PostgreSQL)            │ │
              │  │  Organizations, Agents, Departments  │ │
              │  │  Skills, MCP Tools, Plugins, Usage   │ │
              │  └─────────────────────────────────────┘ │
              │                                         │
              │  Dashboard: Spatial map, Graph, Tables   │
              └─────────────────────────────────────────┘
```

Each registered agent's **git repo, MCP servers, skills, plugins, vendor/model info** are tracked and visualized from a single source of truth.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| DB | Supabase (PostgreSQL) |
| Spatial Canvas | Pixi.js 8 + pixi-viewport |
| Graph View | React Flow (@xyflow/react 12) |
| Charts | Recharts 3 |
| Package Manager | pnpm |
| Deployment | Vercel |

## Directory Structure

```
src/
  app/                    # Next.js App Router pages & API routes
    api/
      organizations/      # CRUD organizations + invite code join
        [orgId]/
          route.ts        # GET full org tree
          agents/         # CRUD agents
          departments/    # CRUD departments
          members/        # CRUD org members
          graph/          # GET pre-computed graph nodes/edges
          chat/           # Chat messages
          conversations/  # Chat conversations
          announcements/  # Org announcements
          humans/         # Human users
          invite-code/    # Generate new invite code
        join/             # Join org via invite code
      cli/                # Auth-free CLI endpoints (login, push, announcements)
      register/           # Legacy agent self-registration
    org/[orgId]/          # Org-scoped pages
      overview/           # Overview page (top skills, featured agents)
      agents/             # Agent data table with CRUD
      departments/        # Department data table with CRUD
      graph/              # Relationship graph (React Flow)
      org-chart/          # Organization hierarchy chart
      cost/               # Cost analytics (charts)
      skills/             # Skill catalog
      chat/               # Chat interface
      settings/           # Org settings & invite code
    login/                # Auth login page (Supabase Auth)
    join-auto/[code]/     # Auto-join via invite link
    auth/callback/        # OAuth callback
  components/
    ui/                   # AppShell, Sidebar, TopBar, BottomBar, Badge, AnnouncementDropdown
    spatial/              # Pixi.js canvas (SpatialCanvas, MapControls)
    graph/                # React Flow graph (GraphPage, DepartmentNode, AgentNode, EntityNode)
    org-chart/            # Org hierarchy chart (OrgChartPage, OrgNode)
    panels/               # Right-side drawers (AgentDrawer, DepartmentDrawer)
    charts/               # Recharts wrappers (CostPieChart, CostTrendChart, UsageBarChart, BudgetGauge)
    database/             # DataTable, AgentForm, DepartmentForm
    chat/                 # ChatPage, ChatMessages, ChatInput, ConversationList, AgentSelector, MessageBubble
  stores/
    app-store.ts          # Zustand store (selection, view mode, org data, announcements)
  types/
    index.ts              # Shared TypeScript types
  lib/
    utils.ts              # Formatting, vendor/status colors, cn()
    auth.ts               # requireAuth(), requireOrgMember(), requireOrgAdmin()
    invite-code.ts        # generateInviteCode()
  hooks/
    useOrgId.ts           # Extract orgId from URL params
  data/
    mock-data.ts          # Mock organization data for development
  db/
    supabase.ts           # Supabase client singleton (service role)
    supabase-server.ts    # Server-side Supabase helper (cookie-based auth)
    supabase-browser.ts   # Browser-side Supabase helper
    seed.ts               # Database seeder
  middleware.ts           # Auth gating, session refresh, legacy route redirects
supabase/
  migrations/             # PostgreSQL schema (9 migrations)
    001_init.sql          # Core tables: organizations, departments, agents, skills, etc.
    002_agent_resources.sql
    003_humans.sql
    004_chat.sql
    005_auth_user_id.sql
    006_member_email.sql
    007_announcements.sql
    008_agent_registered_by.sql
    009_department_hierarchy.sql
cli/                      # Standalone CLI (npx agentfloor)
  bin.mjs                 # Entry point
  commands/               # login, push, status, whoami, logout
  lib/                    # api, config, detect, prompt, log
skills/
  setup/
    SKILL.md              # /agentfloor:setup wizard definition
scripts/
  session-start.mjs       # Session start hook (heartbeat + config check)
hooks/
  hooks.json              # Claude Code hook configuration
.claude-plugin/
  plugin.json             # Plugin manifest
  marketplace.json        # Marketplace listing
```

## Data Flow

1. **Agent Registration**: Users run `/agentfloor:setup` → creates/joins org → registers agent via `POST /api/register`
2. **Session Heartbeat**: On each Claude Code session start, `scripts/session-start.mjs` sends a heartbeat to mark the agent active
3. **API routes** serve data from Supabase (PostgreSQL)
4. **Zustand store** (`app-store.ts`) holds the client-side `Organization` state
5. Pages read from the store; actions (`selectAgent`, `selectDepartment`) trigger drawer panels

## Key Patterns

- **Auth**: Supabase Auth with middleware (`src/middleware.ts`). Redirects unauthenticated users to `/login`. API routes use `requireAuth()` / `requireOrgMember()` / `requireOrgAdmin()` from `src/lib/auth.ts`
- **Org-scoped routes**: All pages under `/org/[orgId]/...`, all API routes under `/api/organizations/[orgId]/...`
- **UI Layout**: Collapsible Sidebar (left, 60px collapsed / 240px expanded) + TopBar (top) + BottomBar (bottom). Main content shifts with sidebar via `ml-16` / `ml-60`
- **Dynamic imports with `ssr: false`**: Pixi.js and React Flow components are client-only
- **Vendor color system**: Consistent color coding via `getVendorColor()` / `getVendorBgColor()` (orange=Anthropic, green=OpenAI, blue=Google)
- **Drawer panels**: Fixed right-side panels at `z-50`, positioned below TopBar
- **Shared nodes in graph**: Skills/MCP tools/plugins used by multiple agents appear as a single node with converging edges
- **Supabase service role**: All DB access uses the service role key (server-side only), RLS enabled but bypassed by service role
- **Public routes**: `/`, `/login`, `/auth/callback`, `/api/cli/*`, `/api/register` — no auth required
