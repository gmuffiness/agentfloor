# AgentFactorio

[English](../.claude/CLAUDE.md) | [한국어](CLAUDE.ko.md)

**GitHub for AI Agents** — GitHub이 코드의 중앙 저장소이듯, AgentFactorio는 에이전트의 중앙 저장소. 조직 내 AI 에이전트들의 설정, 상태, 관계를 한 곳에서 관리하는 기업용 에이전트 허브.

## 프로젝트 개요

조직의 AI 에이전트 함대를 Gather.town 스타일 공간 맵으로 시각화하는 Next.js 16 앱. 부서는 방, 에이전트는 아바타, 스킬은 장비.

서비스 포지셔닝, 타겟 유저, 경쟁 구도: [docs/vision.md](vision.md)

AgentFactorio는 두 부분으로 나뉩니다:
- **Hub (Self-hosting)** — 이 레포 자체. 대시보드 웹앱 + API 서버를 배포합니다. 팀/회사에서 인프라 관리자가 한 번만 세팅합니다.
- **Agent Registration** — 각 개발자가 자기 프로젝트(다른 레포)에서 `/agent-factorio:setup`을 실행해 허브에 에이전트를 등록합니다.

전체 기술 스택, 아키텍처 다이어그램, 디렉토리 구조: [docs/architecture.md](architecture.md)

## 개발 환경 (Hub)

이 레포는 Hub 서버입니다. 아래는 Hub를 로컬에서 실행하기 위한 세팅입니다.

```bash
pnpm install
pnpm dev          # 개발 서버 (http://localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint
```

### Supabase 설정
1. https://supabase.com 에서 프로젝트 생성
2. `npx supabase login` — Supabase 계정 인증
3. `npx supabase link --project-ref <project-id>` — 프로젝트 연결
4. `npx supabase db push` — 마이그레이션 실행 (테이블 생성)
5. `.env`에 프로젝트 URL과 서비스 롤 키 추가:
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

## 핵심 컨벤션

### 코드 스타일
- TypeScript strict 모드, `any` 금지
- Tailwind CSS 4 (CSS modules 사용 안 함)
- `cn()` 유틸리티 (`src/lib/utils.ts`) — 조건부 클래스명
- 벤더 색상: `getVendorColor()` / `getVendorBgColor()` 사용, 하드코딩 금지

### 아키텍처
- **페이지**: `src/app/org/[orgId]/{route}/page.tsx` — `"use client"` 컴포넌트
- **API 라우트**: `src/app/api/organizations/[orgId]/{resource}/route.ts`
- **CLI API 라우트**: `src/app/api/cli/{resource}/route.ts` — `requireCliAuth()` (`src/lib/cli-auth.ts`) 사용
- **인증**: Supabase Auth (미들웨어 `src/middleware.ts`). API 라우트에서 `requireAuth()` / `requireOrgMember()` / `requireOrgAdmin()` 사용 (`src/lib/auth.ts`)
- **컴포넌트**: 도메인별 정리 — `spatial/`, `graph/`, `org-chart/`, `panels/`, `charts/`, `database/`, `chat/`, `ui/`
- **상태**: Zustand store (`src/stores/app-store.ts`) — 단일 store, provider 불필요
- **무거운 클라이언트 라이브러리** (Pixi.js, React Flow): `dynamic()` import + `{ ssr: false }` 필수
- **DB**: Supabase (PostgreSQL) — `@supabase/supabase-js`, 싱글턴 클라이언트 `src/db/supabase.ts`

### 데이터 모델
- Organization (초대 코드 포함) → OrgMember[] + Department[] → Agent[] → Skill[], Plugin[], McpTool[]
- `org_members`: email 기반 식별 (`email` 컬럼), Supabase Auth 연동 시 `user_id` 사용
- `agents`: `registered_by` (FK → `org_members.id`) — 어떤 멤버가 등록했는지 추적
- `cli_auth_tokens`: 로그인 시 발급되는 CLI 인증 토큰, `org`/`agent` CLI 명령어에서 사용
- 타입: `src/types/index.ts`
- DB 스키마: `supabase/migrations/` (PostgreSQL)
- 목 데이터: `src/data/mock-data.ts`

상세 엔티티 레퍼런스: [docs/data-model.md](data-model.md)

### 조직 & 에이전트 등록
- `POST /api/organizations` — 조직 생성 (6자리 초대 코드 자동 생성)
- `POST /api/organizations/join` — 초대 코드로 조직 참여
- `POST /api/cli/login` — CLI 로그인 (이메일 인증, 조직 생성/참여, 인증 토큰 발급)
- `POST /api/cli/push` — 에이전트 등록/업데이트 (vendor, model, MCP tools, skills)
- `GET /api/cli/orgs` — 사용자 조직 목록 (Bearer 토큰 인증)
- `GET /api/cli/agents` — 조직 내 에이전트 목록 (Bearer 토큰 인증)
- `GET/PATCH/DELETE /api/cli/agents/[id]` — 에이전트 CRUD (Bearer 토큰 인증)
- 세션 시작 훅 (`scripts/session-start.mjs`) — 에이전트 활성 상태 하트비트

### UI 레이아웃
- Sidebar (접기 가능, 60px/240px) + TopBar (고정 상단) → 메인 콘텐츠 (pt-12 pb-10, ml-16/ml-60) → BottomBar (고정 하단)
- 네비게이션 링크: `Sidebar.tsx` (TopBar 아님)
- Drawer 패널: 고정 우측, `z-50`, 440px 폭
- 선택 상태: store의 `selectAgent(id)` / `selectDepartment(id)` → drawer 트리거

### API
엔드포인트 레퍼런스: [docs/api-reference.md](api-reference.md)

### 보안 & 시크릿
- **모든 API 키와 자격 증명은 `.env`로 관리** — 소스 코드에 시크릿 하드코딩 금지
- `.env*`는 gitignore — 시크릿은 레포에 커밋되지 않음
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 사이드 전용 — 클라이언트 코드에 노출 금지 (`NEXT_PUBLIC_` 접두사 없음)
- `NEXT_PUBLIC_SUPABASE_URL`만 퍼블릭 환경 변수 (프로젝트 URL, 시크릿 아님)
- `.agent-factorio/config.json` (로컬 에이전트 설정)은 gitignore — 허브 URL과 에이전트 ID 포함
- Supabase 테이블은 RLS 활성화 — 서버 사이드에서는 RLS를 우회하는 서비스 롤 키 사용
- Vercel 배포 시 대시보드에서 환경 변수 설정 (Settings → Environment Variables)

### CLI (`npx agent-factorio`)
- `agent-factorio login` — 허브 연결 + 이메일 인증(magic link) + 조직 생성/참여. 글로벌 config에 `memberId`, `userId`, `authToken` 저장 (`~/.agent-factorio/config.json`)
- `agent-factorio push` — 현재 프로젝트의 에이전트 설정을 허브에 push (자동 감지: git, skills, MCP, CLAUDE.md). `memberId`를 `registered_by`로 기록
- `agent-factorio org list/create/join/switch/info` — 조직 관리
- `agent-factorio agent list/info/edit/pull/delete` — 터미널에서 에이전트 CRUD
- `agent-factorio status` — 현재 프로젝트 등록 상태 확인
- `agent-factorio whoami` — 로그인 정보 확인
- `agent-factorio logout` — 글로벌 config 삭제
- CLI 소스: `cli/` 디렉토리 (bin.js, commands/, lib/)
- CLI API: `POST /api/cli/login`, `POST /api/cli/push`, `GET /api/cli/orgs`, `GET/PATCH/DELETE /api/cli/agents`
- **CLI 코드 변경 시 반드시 `cli/package.json` 버전 bump 후 push** — 안 하면 npm 배포가 skip됨

전체 CLI 매뉴얼, config 형식, 트러블슈팅: [docs/cli.md](cli.md)
npm/Vercel 배포 가이드: [docs/publishing.md](publishing.md)

### 플러그인 시스템 (Agent Registration — 각 개발자의 프로젝트에서 실행)
- `/agent-factorio:setup` — 다른 프로젝트에서 실행하는 인터랙티브 위자드. 허브 URL 입력 → 조직 생성/참여 → 에이전트 등록
- Config: `.agent-factorio/config.json` (gitignore, 각 프로젝트 로컬에 저장)
- 세션 훅: Claude Code 세션 시작 시마다 하트비트 전송
- 플러그인 매니페스트: `.claude-plugin/plugin.json`

## 페이지

모든 페이지는 `/org/[orgId]/` 하위에 위치합니다.

| 경로 | 설명 |
|---|---|
| `/org/[orgId]/overview` | 개요 — 주요 스킬, MCP 도구, 주요 에이전트, 조직 통계 |
| `/org/[orgId]` | 공간 맵 (Pixi.js 캔버스) — 부서 = 방, 에이전트 = 아바타 |
| `/org/[orgId]/graph` | 관계 그래프 (React Flow) — 에이전트/부서/스킬 연결 노드 + 엣지 |
| `/org/[orgId]/org-chart` | 조직 계층 차트 (부서 트리) |
| `/org/[orgId]/agents` | 에이전트 데이터 테이블 (CRUD) |
| `/org/[orgId]/departments` | 부서 데이터 테이블 (CRUD) |
| `/org/[orgId]/cost` | 비용 분석 (파이/바/트렌드 차트) |
| `/org/[orgId]/skills` | 스킬 카탈로그 (카테고리 필터) |
| `/org/[orgId]/chat` | 에이전트 채팅 인터페이스 |
| `/org/[orgId]/settings` | 조직 설정 & 초대 코드 관리 |
