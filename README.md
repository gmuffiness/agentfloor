# AgentFactorio

**GitHub for AI Agents** — GitHub이 코드의 중앙 저장소이듯, AgentFactorio는 에이전트의 중앙 저장소.

조직 내 AI 에이전트들의 설정, 상태, 관계를 한 곳에서 관리하는 에이전트 허브. Gather.town 스타일의 공간 맵으로 부서는 방, 에이전트는 아바타, 스킬은 장비로 시각화합니다.

---

## Quick Start

### 1. 에이전트 등록 (CLI)

```bash
npx agent-factorio login     # 이메일 인증 + 조직 생성/참여
npx agent-factorio push      # 현재 프로젝트의 에이전트를 허브에 등록
```

`login`은 Hub URL(기본: `https://agent-factorio.vercel.app`) 입력 → 이메일 인증 → 조직 생성 또는 초대 코드로 참여 순서로 진행됩니다. `push`는 Git repo, MCP 서버, skills, CLAUDE.md를 자동 감지하여 허브에 등록합니다.

### 2. 대시보드 확인

등록 후 대시보드에서 에이전트를 시각적으로 관리:
- 공간 맵 (Pixi.js) — 부서 = 방, 에이전트 = 아바타
- 관계 그래프 (React Flow) — 에이전트-스킬-MCP 연결
- 에이전트 테이블 — CRUD + 상태 모니터링
- 비용 분석 — 부서/에이전트별 사용량 차트

### 3. 조직 & 에이전트 관리 (CLI)

```bash
# 조직 관리
npx agent-factorio org list       # 내 조직 목록
npx agent-factorio org create     # 새 조직 생성
npx agent-factorio org join       # 초대 코드로 참여
npx agent-factorio org switch     # 기본 조직 변경
npx agent-factorio org info       # 현재 조직 상세 정보

# 에이전트 관리
npx agent-factorio agent list     # 조직 내 에이전트 목록
npx agent-factorio agent info     # 에이전트 상세 정보
npx agent-factorio agent edit     # 에이전트 속성 수정
npx agent-factorio agent pull     # 허브에서 로컬로 동기화
npx agent-factorio agent delete   # 에이전트 삭제

# 기타
npx agent-factorio status         # 현재 프로젝트 등록 상태
npx agent-factorio whoami         # 로그인 정보 확인
npx agent-factorio logout         # 로그아웃
```

전체 CLI 매뉴얼: [docs/cli.md](docs/cli.md)

---

## For AI Agents: Programmatic Setup

> **LLM 에이전트(Claude Code, Codex 등)가 직접 API를 호출하여 등록하는 가이드.**
> 사람이 CLI를 사용하는 경우 위의 Quick Start를 따르세요.

### 기존 조직에 에이전트 등록

**필요 정보:** Hub URL, Invite code (6자리), Agent name, Vendor & Model

```bash
# 1. 조직 참여
curl -X POST {HUB_URL}/api/cli/login \
  -H "Content-Type: application/json" \
  -d '{"action":"join","inviteCode":"{INVITE_CODE}","memberName":"{AGENT_NAME}","email":"{EMAIL}","userId":"{USER_ID}"}'

# 2. 에이전트 등록
curl -X POST {HUB_URL}/api/cli/push \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "{AGENT_NAME}",
    "vendor": "{VENDOR}",
    "model": "{MODEL}",
    "orgId": "{ORG_ID from step 1}",
    "memberId": "{MEMBER_ID from step 1}",
    "mcpTools": [{"name":"server-name","server":"server-name"}],
    "context": [{"type":"claude-md","content":"...","sourceFile":".claude/CLAUDE.md"}]
  }'

# 3. 설정 저장 (.agent-factorio/config.json)
mkdir -p .agent-factorio
echo '{"hubUrl":"{HUB_URL}","orgId":"{ORG_ID}","agentId":"{AGENT_ID}","agentName":"{AGENT_NAME}","vendor":"{VENDOR}","model":"{MODEL}","pushedAt":"{ISO_TIMESTAMP}"}' > .agent-factorio/config.json
```

**자동 감지 항목:**
- Git repo URL: `git remote get-url origin`
- MCP 서버: `.claude/settings.local.json` → `mcpServers` 키
- CLAUDE.md: `.claude/CLAUDE.md` 또는 루트 `CLAUDE.md`
- Skills: `.claude/commands/*.md`, `.claude/skills/**/*.md`

**업데이트:** 요청 body에 `agentId`를 포함하면 기존 에이전트를 업데이트합니다.

API 레퍼런스: [docs/api-reference.md](docs/api-reference.md)

---

## Self-host

AgentFactorio 허브를 직접 배포하려면:

```bash
git clone https://github.com/gmuffiness/agent-factorio.git
cd agent-factorio
pnpm install

# Supabase 세팅
npx supabase login
npx supabase link --project-ref <project-id>
npx supabase db push

# .env 생성
echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co" > .env
echo "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" >> .env

pnpm dev   # http://localhost:3000
```

프로덕션: Vercel에 배포 후 환경 변수 설정.

---

## Dashboard Pages

| Route | Description |
|---|---|
| `/org/[orgId]/overview` | Overview — top skills, MCP tools, featured agents, org stats |
| `/org/[orgId]` | Spatial map — departments as rooms, agents as avatars |
| `/org/[orgId]/graph` | Relationship graph — agents, skills, MCP tools as connected nodes |
| `/org/[orgId]/org-chart` | Organization hierarchy chart |
| `/org/[orgId]/agents` | Agent data table with CRUD |
| `/org/[orgId]/departments` | Department data table with CRUD |
| `/org/[orgId]/cost` | Cost analytics with pie/bar/trend charts |
| `/org/[orgId]/skills` | Skill catalog with category filters |
| `/org/[orgId]/chat` | Chat interface with agent conversations |
| `/org/[orgId]/settings` | Organization settings & invite code |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| DB | Supabase (PostgreSQL) |
| Spatial Canvas | Pixi.js 8 |
| Graph View | React Flow 12 |
| Charts | Recharts 3 |
| CLI | Commander.js |
| Deployment | Vercel |

## Documentation

| Doc | Description |
|---|---|
| [docs/cli.md](docs/cli.md) | CLI 전체 매뉴얼 |
| [docs/api-reference.md](docs/api-reference.md) | API 엔드포인트 레퍼런스 |
| [docs/architecture.md](docs/architecture.md) | 아키텍처 & 디렉토리 구조 |
| [docs/data-model.md](docs/data-model.md) | 데이터 모델 상세 |
| [docs/vision.md](docs/vision.md) | 서비스 포지셔닝 & 비전 |
| [docs/publishing.md](docs/publishing.md) | npm/Vercel 배포 가이드 |

## License

MIT
