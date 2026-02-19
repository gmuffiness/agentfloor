# Architecture

## Overview

AgentFloor is a **centralized monitoring hub** for distributed AI agent fleets. Individual developers clone the repo, run `/agentfloor:setup`, and their Claude Code agents register to a shared organization. The hub visualizes all agents across the organization in a Gather.town-style spatial dashboard.

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
      organization/       # GET full org tree
      organizations/      # CRUD organizations + invite code join
      agents/             # CRUD agents
      departments/        # CRUD departments
      graph/              # GET pre-computed graph nodes/edges
      register/           # Agent self-registration
    graph/                # /graph page (React Flow)
    agents/               # /agents page (data table)
    departments/          # /departments page (data table)
    cost/                 # /cost page (charts)
    skills/               # /skills page (catalog)
  components/
    ui/                   # AppShell, TopBar, BottomBar, Badge
    spatial/              # Pixi.js canvas (SpatialCanvas, DepartmentRoom, AgentAvatar)
    graph/                # React Flow graph (GraphPage, DepartmentNode, AgentNode, EntityNode)
    panels/               # Right-side drawers (AgentDrawer, DepartmentDrawer)
    charts/               # Recharts wrappers (CostPieChart, CostTrendChart, UsageBarChart)
    database/             # DataTable, forms
  stores/
    app-store.ts          # Zustand store (selection, view mode, org data)
  types/
    index.ts              # Shared TypeScript types
  lib/
    utils.ts              # Formatting, vendor/status colors, cn()
  data/
    mock-data.ts          # Mock organization data for development
  db/
    supabase.ts           # Supabase client singleton
    schema.ts             # Legacy Drizzle schema (type reference)
    index.ts              # Legacy SQLite connection (deprecated)
    seed.ts               # Database seeder
supabase/
  migrations/
    001_init.sql          # PostgreSQL schema (run in Supabase SQL editor)
skills/
  setup/
    SKILL.md              # /agentfloor:setup wizard definition
scripts/
  session-start.mjs       # Session start hook (heartbeat + config check)
  lib/
    stdin.mjs             # CLI prompt utilities
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

- **Dynamic imports with `ssr: false`**: Pixi.js and React Flow components are client-only
- **Vendor color system**: Consistent color coding via `getVendorColor()` / `getVendorBgColor()` (orange=Anthropic, green=OpenAI, blue=Google)
- **Drawer panels**: Fixed right-side panels at `z-50`, positioned below TopBar (`top-14`)
- **Shared nodes in graph**: Skills/MCP tools/plugins used by multiple agents appear as a single node with converging edges
- **Supabase service role**: All DB access uses the service role key (server-side only), RLS enabled but bypassed by service role
