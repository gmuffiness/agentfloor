# AgentFactorio

[English](../README.md) | [한국어](README.ko.md)

**GitHub for AI Agents** — GitHub이 코드의 중앙 저장소이듯, AgentFactorio는 에이전트의 중앙 저장소. 조직 내 AI 에이전트들의 설정, 상태, 관계를 한 곳에서 관리하는 에이전트 허브.

Gather.town 스타일의 공간 맵으로 부서는 방, 에이전트는 아바타, 스킬은 장비로 시각화합니다.

---

## 빠른 시작

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
agent-factorio org list       # 내 조직 목록
agent-factorio org create     # 새 조직 생성
agent-factorio org join       # 초대 코드로 참여
agent-factorio org switch     # 기본 조직 변경
agent-factorio org info       # 현재 조직 상세 정보

# 에이전트 관리
agent-factorio agent list     # 조직 내 에이전트 목록
agent-factorio agent info     # 에이전트 상세 정보
agent-factorio agent edit     # 에이전트 속성 수정
agent-factorio agent pull     # 허브에서 로컬로 동기화
agent-factorio agent delete   # 에이전트 삭제

# 기타
agent-factorio status         # 현재 프로젝트 등록 상태
agent-factorio whoami         # 로그인 정보 확인
agent-factorio logout         # 로그아웃
```

전체 CLI 매뉴얼: [cli.md](cli.md)

---

## AI 에이전트용: API 직접 호출

> **LLM 에이전트(Claude Code, Codex 등)가 직접 API를 호출하여 등록하는 가이드.**
> 사람이 CLI를 사용하는 경우 위의 빠른 시작을 따르세요.

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

API 레퍼런스: [api-reference.md](api-reference.md)

---

## 셀프 호스팅

전체 배포 가이드: [publishing.md](publishing.md)

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

## 대시보드 페이지

| 경로 | 설명 |
|---|---|
| `/org/[orgId]/overview` | 개요 — 주요 스킬, MCP 도구, 주요 에이전트, 조직 통계 |
| `/org/[orgId]` | 공간 맵 — 부서 = 방, 에이전트 = 아바타 |
| `/org/[orgId]/graph` | 관계 그래프 — 에이전트, 스킬, MCP 도구의 연결 |
| `/org/[orgId]/org-chart` | 조직 계층 차트 |
| `/org/[orgId]/agents` | 에이전트 데이터 테이블 (CRUD) |
| `/org/[orgId]/departments` | 부서 데이터 테이블 (CRUD) |
| `/org/[orgId]/cost` | 비용 분석 (파이/바/트렌드 차트) |
| `/org/[orgId]/skills` | 스킬 카탈로그 (카테고리 필터) |
| `/org/[orgId]/chat` | 에이전트 채팅 인터페이스 |
| `/org/[orgId]/settings` | 조직 설정 & 초대 코드 관리 |

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript 5 |
| 스타일링 | Tailwind CSS 4 |
| 상태 관리 | Zustand 5 |
| DB | Supabase (PostgreSQL) |
| 공간 캔버스 | Pixi.js 8 |
| 그래프 뷰 | React Flow 12 |
| 차트 | Recharts 3 |
| CLI | Commander.js |
| 배포 | Vercel |

## 문서

| 문서 | 설명 |
|---|---|
| [cli.md](cli.md) | CLI 전체 매뉴얼 |
| [api-reference.md](api-reference.md) | API 엔드포인트 레퍼런스 |
| [architecture.md](architecture.md) | 아키텍처 & 디렉토리 구조 |
| [data-model.md](data-model.md) | 데이터 모델 상세 |
| [vision.md](vision.md) | 서비스 포지셔닝 & 비전 |
| [publishing.md](publishing.md) | npm/Vercel 배포 가이드 |
| [cost-tracking.md](cost-tracking.md) | 비용 추적 설계 문서 |
| [roadmap.md](roadmap.md) | 로드맵 & 미구현 기능 분석 |

## 라이선스

MIT
