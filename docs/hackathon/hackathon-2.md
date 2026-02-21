# 두 번째 해커톤 - 아이디어 등록

## 제품/서비스명 (40자 이하)

AgentFactorio

## 한 줄 소개 (60자 이하)

흩어진 AI 에이전트를 한곳에 모아 공간 맵으로 보여주는 팀 허브

## 상세 설명

한 사람이 다루는 AI 에이전트가 1개에서 N개로 늘어나고 있습니다. 개인은 괜찮아도, 팀과 조직이 커질수록 흩어진 에이전트들의 전체 그림이 보이지 않습니다. 누가 어떤 에이전트를 담당하는지, 각 부서에서 어떤 스킬과 MCP 도구를 쓰는지, 비용은 얼마인지 — 이 정보들이 각자의 로컬에 파편화되어 있습니다.

AgentFactorio는 이 문제를 해결합니다. 각 개발자가 Claude Code, Cursor, Codex 등 어떤 도구를 쓰든, `npx agent-factorio push` 한 줄이면 에이전트 정보(git repo, MCP 서버, 스킬, 벤더/모델)가 자동 감지되어 중앙 허브에 등록됩니다. 회사에서 사람이 늘어나면 사내 인명록이 필요하듯, AI 에이전트가 늘어나면 에이전트 인명록이 필요합니다.

핵심 차별화는 Gather.town 스타일의 2D Spatial Map입니다. 부서를 방(Room)으로, 에이전트를 아바타(Avatar)로, 스킬을 장비(Equipment)로 표현하여 전사 AI 에이전트 현황을 게임처럼 직관적으로 보여줍니다. 기존 솔루션(Portkey, Helicone, LiteLLM)이 숫자와 차트 나열에 그치는 반면, AgentFactorio는 공간적 시각화로 한눈에 fleet을 파악할 수 있게 합니다.

현재 구현된 기능: Spatial Map (Pixi.js), Relationship Graph (React Flow), Agent/Department CRUD, Cost Analytics, Skill Catalog, Chat, CLI (npx agent-factorio), 조직 초대 코드 시스템, Supabase Auth 연동

기술 스택: Next.js 16, TypeScript, Pixi.js 8, React Flow, Recharts, Zustand, Supabase (PostgreSQL), Tailwind CSS 4

## 고객 정의 및 해결 방안

### 1번

- **Customer Segment**: CTO / VP of Engineering (엔지니어 100-500명 규모 미드마켓 기업)
- **문제점**: 부서별로 AI 에이전트를 독립적으로 도입하면서 전사 관점의 통합 뷰가 없음. 어떤 팀이 어떤 에이전트를 쓰는지, 전체 비용이 얼마인지 파악하려면 각 벤더 콘솔을 개별 확인해야 함
- **Value Proposition**: Gather.town 스타일 Spatial Map으로 전사 AI 에이전트 현황을 한 화면에서 파악. 부서별 비용 귀속, 벤더별 비율, 에이전트 상태를 직관적으로 시각화하여 경영진 보고에도 바로 활용 가능

### 2번

- **Customer Segment**: 엔지니어링 팀 리더 / 테크 리드
- **문제점**: 팀원들이 어떤 스킬/MCP 도구 조합을 쓰는지 공유가 안 되어 베스트 프랙티스가 팀 내에서 전파되지 않음. 좋은 에이전트 설정을 발견해도 다른 팀원에게 복제하기 어려움
- **Value Proposition**: Skill Catalog에서 조직 전체의 스킬/도구 인벤토리를 한눈에 파악하고, 인기 스킬을 내 에이전트에 바로 추가 가능. 에이전트 설정을 템플릿으로 저장/공유/복제하는 내부 마켓플레이스 제공

### 3번

- **Customer Segment**: 개별 개발자 (AI 에이전트 사용자)
- **문제점**: 에이전트를 등록하고 관리하는 과정이 번거로움. 별도의 관리 콘솔에 접속해서 수동으로 정보를 입력해야 함
- **Value Proposition**: `npx agent-factorio push` 한 줄로 에이전트 자동 등록. git repo, CLAUDE.md, MCP 설정, 스킬을 자동 감지하여 허브에 push. Session start hook으로 에이전트 상태(active/idle/offline)를 자동 추적하므로 개발자가 신경 쓸 것이 없음

## 팀원 모집 공고문

흩어진 AI 에이전트를 한곳에 모으는 팀 허브, AgentFactorio를 함께 만들 팀원을 찾습니다.

코스맥스에서 AI 에이전트를 개발하고 있는 문대정입니다. 1인 N에이전트 시대, 조직 내 에이전트들이 파편화되는 문제를 Gather.town 스타일의 공간 맵으로 해결하는 서비스를 만들고 있습니다. 현재 MVP(Next.js 16 + Pixi.js + Supabase)가 동작 중이며, 해커톤에서 실시간 Heartbeat, 에이전트 마켓플레이스, 스킬 추천 기능을 추가하려 합니다.

이런 분을 찾습니다:
- AI 에이전트 도구(Claude Code, Cursor, Codex 등)를 실제로 사용하고 계신 분
- 프론트엔드(React/Next.js) 또는 백엔드(Supabase/PostgreSQL) 경험이 있으신 분
- "에이전트가 에이전트를 관리한다"는 메타적 컨셉에 흥미를 느끼시는 분

GitHub: https://github.com/gmuffiness
LinkedIn: https://www.linkedin.com/in/daejeong-mun-0949911b3/
