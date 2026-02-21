<!-- OMC:START -->
<!-- OMC:END -->

# AgentFactorio

**GitHub for AI Agents** — A centralized hub for managing AI agent configurations, status, and relationships across your organization.

## Project Overview

A Next.js 16 app that visualizes organizational AI agent fleets as a Gather.town-style spatial map. Departments are rooms, agents are avatars, skills are equipment.

See [docs/vision.md](../docs/vision.md) for service positioning, target users, and competitive landscape.

AgentFactorio has two parts:
- **Hub (Self-hosting)** — This repo. Deploys the dashboard web app + API server. Set up once per team/company by an infra admin.
- **Agent Registration** — Individual developers run `/agent-factorio:setup` in their projects (other repos) to register agents to the hub.

See [docs/architecture.md](../docs/architecture.md) for full tech stack, architecture diagram, and directory layout.

## Development (Hub)

This repo is the Hub server. Below is the setup for running locally.

```bash
pnpm install
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint
```

### Supabase Setup
1. Create a Supabase project at https://supabase.com
2. `npx supabase login` — Authenticate with Supabase
3. `npx supabase link --project-ref <project-id>` — Link project
4. `npx supabase db push` — Run migrations (create tables)
5. Copy project URL and service role key to `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Supabase CLI (DB Management)
Use Supabase CLI when DB schema changes are needed:
```bash
npx supabase migration new <name>   # Create new migration file (supabase/migrations/)
npx supabase db push                # Apply migrations to remote DB
npx supabase db reset               # Reset local DB (re-run all migrations)
npx supabase db diff                # Check schema diff with remote DB
npx supabase gen types typescript --linked > src/types/supabase.ts  # Auto-generate DB types
```
- Migration files are stored in `supabase/migrations/`
- Always manage new tables/columns via migration files (no manual SQL edits)
- **Always run `npx supabase db push` after schema changes** — creating migration files alone does not apply them

## Key Conventions

### Code Style
- TypeScript strict mode, no `any`
- Tailwind CSS 4 for styling (no CSS modules)
- `cn()` utility from `src/lib/utils.ts` for conditional class names
- Vendor colors: use `getVendorColor()` / `getVendorBgColor()` from utils, never hardcode

### Architecture
- **Pages** go in `src/app/org/[orgId]/{route}/page.tsx` as `"use client"` components
- **API routes** go in `src/app/api/organizations/[orgId]/{resource}/route.ts`
- **CLI API routes** go in `src/app/api/cli/{resource}/route.ts` — use `requireCliAuth()` from `src/lib/cli-auth.ts`
- **Auth**: Supabase Auth via middleware (`src/middleware.ts`). API routes use `requireAuth()` / `requireOrgMember()` / `requireOrgAdmin()` from `src/lib/auth.ts`
- **Components** organized by domain: `spatial/`, `graph/`, `org-chart/`, `panels/`, `charts/`, `database/`, `chat/`, `ui/`
- **State** via Zustand store (`src/stores/app-store.ts`) — single store, no providers needed
- **Heavy client libs** (Pixi.js, React Flow) must use `dynamic()` import with `{ ssr: false }`
- **DB**: Supabase (PostgreSQL) via `@supabase/supabase-js` — client singleton at `src/db/supabase.ts`

### Data Model
- Organization (with invite code) → OrgMember[] + Department[] → Agent[] → Skill[], Plugin[], McpTool[]
- `org_members`: email-based identification (`email` column), `user_id` for Supabase Auth
- `agents`: `registered_by` (FK → `org_members.id`) — tracks which member registered it
- `cli_auth_tokens`: persistent CLI auth tokens issued on login, used for `org` and `agent` CLI commands
- Types defined in `src/types/index.ts`
- DB schema across migrations in `supabase/migrations/` (PostgreSQL)
- Mock data in `src/data/mock-data.ts` for development

See [docs/data-model.md](../docs/data-model.md) for detailed entity reference.

### Organization & Agent Registration
- `POST /api/organizations` — create org (auto-generates 6-char invite code)
- `POST /api/organizations/join` — join org via invite code
- `POST /api/cli/login` — CLI login with email verification, org create/join, auth token issuance
- `POST /api/cli/push` — register/update agent with vendor, model, MCP tools, skills
- `GET /api/cli/orgs` — list user's organizations (Bearer token auth)
- `GET /api/cli/agents` — list agents in an org (Bearer token auth)
- `GET/PATCH/DELETE /api/cli/agents/[id]` — agent CRUD (Bearer token auth)
- Session start hook (`scripts/session-start.mjs`) sends heartbeat to mark agent active

### UI Layout
- Sidebar (collapsible left, 60px/240px) + TopBar (fixed top) → main content (pt-12 pb-10, ml-16/ml-60) → BottomBar (fixed bottom)
- Navigation links are in `Sidebar.tsx` (not TopBar)
- Drawer panels: fixed right-side, `z-50`, 440px wide
- Selection state: `selectAgent(id)` / `selectDepartment(id)` in store triggers drawers

### API
See [docs/api-reference.md](../docs/api-reference.md) for endpoint reference.

### Documentation
- **All docs in `docs/` must be written in English** — Korean version is only at `docs/README.ko.md`
- `docs/` — Public-facing documentation (cli, api-reference, architecture, data-model, vision, publishing, etc.)
- `docs/dev/` — Internal dev notes, research, and analysis (gitignored, not published)
- When writing new documentation, place it in `docs/` (English). For internal/research notes, use `docs/dev/`

### Security & Secrets
- **All API keys and credentials are managed in `.env`** — never hardcode secrets in source code
- `.env*` is gitignored — secrets are never committed to the repository
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never expose in client code (no `NEXT_PUBLIC_` prefix)
- `NEXT_PUBLIC_SUPABASE_URL` is the only public env var (project URL, not a secret)
- `.agent-factorio/config.json` (local agent config) is gitignored — contains hub URL and agent ID
- Supabase tables have RLS enabled — all server-side access uses the service role key which bypasses RLS
- For Vercel deployment, set env vars in the Vercel dashboard (Settings → Environment Variables)

### CLI (`npx agent-factorio`)
- `agent-factorio login` — Connect to hub + email verification (magic link) + org create/join. Saves `memberId`, `userId`, `authToken` to global config (`~/.agent-factorio/config.json`)
- `agent-factorio push` — Push current project's agent config to hub (auto-detects: git, skills, MCP, CLAUDE.md). Records `memberId` as `registered_by`
- `agent-factorio org list/create/join/switch/info` — Organization management
- `agent-factorio agent list/info/edit/pull/delete` — Agent CRUD from terminal
- `agent-factorio status` — Current project registration status
- `agent-factorio whoami` — Login info
- `agent-factorio logout` — Remove global config
- CLI source: `cli/` directory (bin.js, commands/, lib/)
- CLI APIs: `POST /api/cli/login`, `POST /api/cli/push`, `GET /api/cli/orgs`, `GET/PATCH/DELETE /api/cli/agents`
- **Always bump `cli/package.json` version before pushing CLI code changes** — otherwise npm publish is skipped

See [docs/cli.md](../docs/cli.md) for full CLI manual, config format, and troubleshooting.
See [docs/publishing.md](../docs/publishing.md) for npm/Vercel deployment guide.

### Plugin System (Agent Registration — runs in each developer's project)
- `/agent-factorio:setup` — Interactive wizard run from other projects. Enter hub URL → create/join org → register agent
- Config stored in `.agent-factorio/config.json` (gitignored, local to each project)
- Session hook sends heartbeat on every Claude Code session start
- Plugin manifest at `.claude-plugin/plugin.json`

## Pages

All pages are org-scoped under `/org/[orgId]/`.

| Route | Description |
|---|---|
| `/org/[orgId]/overview` | Overview — top skills, MCP tools, featured agents, org stats |
| `/org/[orgId]` | Spatial map (Pixi.js canvas) — departments as rooms, agents as avatars |
| `/org/[orgId]/graph` | Relationship graph (React Flow) — nodes + edges showing agent/dept/skill connections |
| `/org/[orgId]/org-chart` | Organization hierarchy chart (department tree) |
| `/org/[orgId]/agents` | Agent data table with CRUD |
| `/org/[orgId]/departments` | Department data table with CRUD |
| `/org/[orgId]/cost` | Cost analytics with pie/bar/trend charts |
| `/org/[orgId]/skills` | Skill catalog with category filters |
| `/org/[orgId]/chat` | Chat interface with agent conversations |
| `/org/[orgId]/settings` | Organization settings & invite code management |
