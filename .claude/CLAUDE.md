<!-- OMC:START -->
<!-- OMC:END -->

# AgentFloor

AI Agent Fleet Management — centralized monitoring hub for distributed Claude Code agents.

## Project Overview

A Next.js 16 app that visualizes organizational AI agent fleets as a Gather.town-style spatial map. Departments are rooms, agents are avatars, skills are equipment.

**Core concept**: Any developer can clone this repo, run `/agentfloor:setup`, and register their Claude Code agent to a shared organization. The hub tracks each agent's vendor, model, MCP servers, skills, and plugins — providing a single pane of glass for the entire AI fleet.

See [docs/architecture.md](../docs/architecture.md) for full tech stack, architecture diagram, and directory layout.

## Development

```bash
pnpm install
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint
```

### Supabase Setup
1. Create a Supabase project at https://supabase.com
2. `npx supabase login` — Supabase 계정 인증
3. `npx supabase link --project-ref <project-id>` — 프로젝트 연결
4. `npx supabase db push` — 마이그레이션 실행 (테이블 생성)
5. Copy project URL and service role key to `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Supabase CLI (DB 관리)
DB 스키마 변경이 필요할 때는 Supabase CLI를 사용합니다:
```bash
npx supabase migration new <name>   # 새 마이그레이션 파일 생성 (supabase/migrations/)
npx supabase db push                # 마이그레이션을 원격 DB에 적용
npx supabase db reset               # 로컬 DB 초기화 (모든 마이그레이션 재실행)
npx supabase db diff                # 원격 DB와 로컬 스키마 차이 확인
npx supabase gen types typescript --linked > src/types/supabase.ts  # DB 타입 자동 생성
```
- 마이그레이션 파일은 `supabase/migrations/` 디렉토리에 저장
- 새 테이블/컬럼 추가 시 반드시 마이그레이션 파일로 관리 (수동 SQL 편집 금지)

## Key Conventions

### Code Style
- TypeScript strict mode, no `any`
- Tailwind CSS 4 for styling (no CSS modules)
- `cn()` utility from `src/lib/utils.ts` for conditional class names
- Vendor colors: use `getVendorColor()` / `getVendorBgColor()` from utils, never hardcode

### Architecture
- **Pages** go in `src/app/{route}/page.tsx` as `"use client"` components
- **API routes** go in `src/app/api/{resource}/route.ts`
- **Components** organized by domain: `spatial/`, `graph/`, `panels/`, `charts/`, `database/`, `ui/`
- **State** via Zustand store (`src/stores/app-store.ts`) — single store, no providers needed
- **Heavy client libs** (Pixi.js, React Flow) must use `dynamic()` import with `{ ssr: false }`
- **DB**: Supabase (PostgreSQL) via `@supabase/supabase-js` — client singleton at `src/db/supabase.ts`

### Data Model
- Organization (with invite code) → OrgMember[] + Department[] → Agent[] → Skill[], Plugin[], McpTool[]
- Types defined in `src/types/index.ts`
- DB schema in `supabase/migrations/001_init.sql` (PostgreSQL)
- Mock data in `src/data/mock-data.ts` for development

See [docs/data-model.md](../docs/data-model.md) for detailed entity reference.

### Organization & Agent Registration
- `POST /api/organizations` — create org (auto-generates 6-char invite code)
- `POST /api/organizations/join` — join org via invite code
- `POST /api/register` — register agent with vendor, model, MCP tools, skills
- Session start hook (`scripts/session-start.mjs`) sends heartbeat to mark agent active

### UI Layout
- TopBar (h-14, z-50, fixed top) → main content (pt-14 pb-10) → BottomBar (h-10, z-50, fixed bottom)
- Drawer panels: fixed right-side, `top-14`, `z-50`, 440px wide
- Selection state: `selectAgent(id)` / `selectDepartment(id)` in store triggers drawers

### API
See [docs/api-reference.md](../docs/api-reference.md) for endpoint reference.

### Security & Secrets
- **All API keys and credentials are managed in `.env`** — never hardcode secrets in source code
- `.env*` is gitignored — secrets are never committed to the repository
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never expose in client code (no `NEXT_PUBLIC_` prefix)
- `NEXT_PUBLIC_SUPABASE_URL` is the only public env var (project URL, not a secret)
- `.agentfloor/config.json` (local agent config) is gitignored — contains hub URL and agent ID
- Supabase tables have RLS enabled — all server-side access uses the service role key which bypasses RLS
- For Vercel deployment, set env vars in the Vercel dashboard (Settings → Environment Variables)

### Plugin System
- `/agentfloor:setup` — interactive wizard to create/join org and register agent
- Config stored in `.agentfloor/config.json` (gitignored)
- Session hook sends heartbeat on every Claude Code session start
- Plugin manifest at `.claude-plugin/plugin.json`

## Pages

| Route | Description |
|---|---|
| `/` | Spatial map (Pixi.js canvas) — departments as rooms, agents as avatars |
| `/graph` | Relationship graph (React Flow) — nodes + edges showing agent/dept/skill connections |
| `/agents` | Agent data table with CRUD |
| `/departments` | Department data table with CRUD |
| `/cost` | Cost analytics with pie/bar/trend charts |
| `/skills` | Skill catalog with category filters |
