<!-- OMC:START -->
<!-- OMC:END -->

# AgentFloor

**GitHub for AI Agents** — GitHub이 코드의 중앙 저장소이듯, AgentFloor는 에이전트의 중앙 저장소. 조직 내 AI 에이전트들의 설정, 상태, 관계를 한 곳에서 관리하는 기업용 에이전트 허브.

## Project Overview

A Next.js 16 app that visualizes organizational AI agent fleets as a Gather.town-style spatial map. Departments are rooms, agents are avatars, skills are equipment.

See [docs/vision.md](../docs/vision.md) for service positioning, target users, and competitive landscape.

AgentFloor는 두 부분으로 나뉩니다:
- **Hub (Self-hosting)** — 이 레포 자체. 대시보드 웹앱 + API 서버를 배포합니다. 팀/회사에서 인프라 관리자가 한 번만 세팅합니다.
- **Agent Registration** — 각 개발자가 자기 프로젝트(다른 레포)에서 `/agentfloor:setup`을 실행해 허브에 에이전트를 등록합니다.

See [docs/architecture.md](../docs/architecture.md) for full tech stack, architecture diagram, and directory layout.

## Development (Hub)

이 레포는 Hub 서버입니다. 아래는 Hub를 로컬에서 실행하기 위한 세팅입니다.

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
- **DB 스키마 변경 시 반드시 `npx supabase db push` 실행** — 마이그레이션 파일 생성만으로는 DB에 반영되지 않음

## Key Conventions

### Code Style
- TypeScript strict mode, no `any`
- Tailwind CSS 4 for styling (no CSS modules)
- `cn()` utility from `src/lib/utils.ts` for conditional class names
- Vendor colors: use `getVendorColor()` / `getVendorBgColor()` from utils, never hardcode

### Architecture
- **Pages** go in `src/app/org/[orgId]/{route}/page.tsx` as `"use client"` components
- **API routes** go in `src/app/api/organizations/[orgId]/{resource}/route.ts`
- **Auth**: Supabase Auth via middleware (`src/middleware.ts`). API routes use `requireAuth()` / `requireOrgMember()` / `requireOrgAdmin()` from `src/lib/auth.ts`
- **Components** organized by domain: `spatial/`, `graph/`, `org-chart/`, `panels/`, `charts/`, `database/`, `chat/`, `ui/`
- **State** via Zustand store (`src/stores/app-store.ts`) — single store, no providers needed
- **Heavy client libs** (Pixi.js, React Flow) must use `dynamic()` import with `{ ssr: false }`
- **DB**: Supabase (PostgreSQL) via `@supabase/supabase-js` — client singleton at `src/db/supabase.ts`

### Data Model
- Organization (with invite code) → OrgMember[] + Department[] → Agent[] → Skill[], Plugin[], McpTool[]
- `org_members`: email 기반 식별 (`email` 컬럼), Supabase Auth 연동 시 `user_id` 사용
- `agents`: `registered_by` (FK → `org_members.id`) — 어떤 멤버가 등록했는지 추적
- Types defined in `src/types/index.ts`
- DB schema across 9 migrations in `supabase/migrations/` (PostgreSQL)
- Mock data in `src/data/mock-data.ts` for development

See [docs/data-model.md](../docs/data-model.md) for detailed entity reference.

### Organization & Agent Registration
- `POST /api/organizations` — create org (auto-generates 6-char invite code)
- `POST /api/organizations/join` — join org via invite code
- `POST /api/cli/push` — register/update agent with vendor, model, MCP tools, skills
- `POST /api/register` — legacy agent registration (prefer `cli/push`)
- Session start hook (`scripts/session-start.mjs`) sends heartbeat to mark agent active

### UI Layout
- Sidebar (collapsible left, 60px/240px) + TopBar (fixed top) → main content (pt-12 pb-10, ml-16/ml-60) → BottomBar (fixed bottom)
- Navigation links are in `Sidebar.tsx` (not TopBar)
- Drawer panels: fixed right-side, `z-50`, 440px wide
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

### CLI (`npx agentfloor`)
- `agentfloor login` — 허브 연결 + 이메일 인증(magic link) + 조직 참여/생성. 글로벌 config에 `memberId`, `userId` 저장 (`~/.agentfloor/config.json`)
- `agentfloor push` — 현재 프로젝트의 에이전트 설정을 허브에 push (자동 감지: git, skills, MCP, CLAUDE.md). `memberId`를 `registered_by`로 기록
- `agentfloor status` — 현재 프로젝트 등록 상태 확인
- `agentfloor whoami` — 로그인 정보 확인
- `agentfloor logout` — 글로벌 config 삭제
- CLI 소스: `cli/` 디렉토리 (bin.mjs, commands/, lib/)
- CLI 전용 API: `POST /api/cli/login`, `POST /api/cli/push`
- **CLI 코드 변경 시 반드시 `cli/package.json` 버전 bump 후 push** — 안 하면 npm 배포가 skip됨

See [docs/cli.md](../docs/cli.md) for full CLI manual, config format, and troubleshooting.
See [docs/publishing.md](../docs/publishing.md) for npm/Vercel 배포 가이드.

### Plugin System (Agent Registration — 각 개발자의 프로젝트에서 실행)
- `/agentfloor:setup` — 다른 프로젝트에서 실행하는 인터랙티브 위자드. 허브 URL 입력 → 조직 생성/참여 → 에이전트 등록
- Config stored in `.agentfloor/config.json` (gitignored, 각 프로젝트 로컬에 저장)
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
