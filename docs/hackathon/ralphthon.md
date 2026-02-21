# 랄프톤(Ralphthon) 해커톤 신청서

## 1. 팀 소개

**문대정 (Daejeong Mun)**

- LinkedIn: https://www.linkedin.com/in/daejeong-mun-0949911b3/
- GitHub: https://github.com/gmuffiness

글로벌 1위 화장품 ODM 기업 코스맥스에서 AI 에이전트를 개발하고 있습니다.

버티컬 도메인에 특화된 AI 에이전트에 깊은 관심을 가지고 있으며, 단순한 PoC를 넘어 실제 사용자에게 의미 있는 가치를 제공하는 서비스를 만드는 것을 목표로 하고 있습니다. 이를 위해 다음 두 가지를 중요하게 생각하며 실천하고 있습니다.

첫째, **도메인에 대한 깊은 이해**입니다. 화장품 및 뷰티 분야의 원료, 규제, 트렌드 등에 대한 이해를 넓히고, 사용자 관점에서 문제를 정의하고 해결하기 위해 노력하고 있습니다. 이러한 과정의 일환으로 맞춤형화장품조제관리사 자격을 취득하였습니다.

둘째, **최신 AI 기술의 빠른 습득과 실무 적용**입니다. AI Maker 밋업, Claude Code 밋업 등에 적극적으로 참여하며 기술 발전의 최전선에 있는 분들의 인사이트를 배우고, 이를 실제 서비스 개발에 적용하고 있습니다. 또한, 최근에는 자체 평가 harness를 구축하여 카카오임팩트가 주관한 AITOP100 대회에서 TOP20에 선정되어 특별상을 수상하였습니다. (참고: https://brunch.co.kr/@andkakao/329)

**보유기술 / 직무역량:**
- OpenAI Agent SDK 기반 AI Agent 설계 및 개발 경험
- PDF, Excel, PPTX 등 다양한 문서 처리 및 RAG 파이프라인 구축
- 데이터 수집, 가공, 임베딩, 검색까지 end-to-end 데이터 파이프라인 구현
- 자체 evaluation harness 구축을 통한 Agent 성능 개선 경험
- 오픈소스 개발 및 기여 경험
  - CRAFT-train: OCR detection 모델 학습 파이프라인 구현 및 공개
  - EasyOCR: 글로벌 OCR 라이브러리 detection training 코드 기여
  - Mindcraft: LLM 기반 게임 AI Agent perception 및 interaction 기능 개선 기여

---

## 2. 해커톤에서 구현할 아이디어

### AgentFactorio — 흩어진 AI 에이전트를 한곳에 모으는 팀 허브

#### 문제: 1인 N에이전트 시대, 조직에서는 전체 그림이 안 보인다

한 사람이 다루는 AI 에이전트가 1개에서 2개, N개로 늘어나고 있습니다. 개인 차원에서는 관리가 되더라도, **팀과 조직이 커질수록 흩어진 에이전트들의 전체 그림이 보이지 않습니다.** 누가 어떤 에이전트를 담당하는지, 각 부서에서 어떤 스킬과 MCP 도구를 쓰고 있는지, 비용은 얼마나 나가는지 — 이 정보들이 각자의 로컬에 파편화되어 있습니다.

기존 솔루션(Portkey, Helicone, LiteLLM)은 비용 추적에 강하지만 숫자와 차트 나열에 그치고, Microsoft Agent 365는 MS 생태계에 종속됩니다. **흩어진 에이전트를 한곳에 모아서 직관적으로 보여주는 도구는 아직 없습니다.**

#### 해법: 각자 push하면, 한곳에 모인다

```
개발자 A (Claude Code)  ──push──┐
개발자 B (Cursor)        ──push──┤──→  AgentFactorio Hub  ──→  대시보드
개발자 C (Codex)         ──push──┘     (Supabase DB)       (Spatial Map, Graph, Tables)
```

각 개발자가 Claude Code, Cursor, Codex 등 어떤 도구를 쓰든 상관없이, `npx agent-factorio push` 한 줄이면 에이전트의 git repo, MCP 서버, 스킬, 벤더/모델 정보가 자동 감지되어 중앙 허브에 등록됩니다. 회사에서 사람이 늘어나면 사내 인명록이 필요하듯, AI 에이전트가 늘어나면 **에이전트 인명록**이 필요합니다. AgentFactorio가 바로 그 역할입니다.

#### 차별화: Gather.town 스타일 Spatial GUI

AgentFactorio의 핵심 차별화는 **게더타운 스타일의 2D 공간 맵**입니다. 부서를 방(Room)으로, 에이전트를 아바타(Avatar)로, 스킬을 장비(Equipment)로 표현하여 조직 전체의 AI 에이전트 fleet을 한눈에 파악할 수 있습니다.

- **Spatial Map** (Pixi.js) — 부서별 방에 에이전트 아바타가 배치, 벤더별 색상 구분, 실시간 상태 반영
- **Relationship Graph** (React Flow) — 에이전트/부서/스킬 간 연결 관계를 노드-엣지로 시각화
- **Data Tables** — 에이전트, 부서, 스킬의 CRUD 관리
- **Cost Analytics** — 부서별/벤더별 비용 파이차트, 트렌드, 예산 게이지

#### 생태계 포지셔닝

Moltbook이 AI 에이전트를 위한 퍼블릭 소셜 네트워크라면, AgentFactorio는 **조직 내부에서 에이전트를 한곳에 모아두는 프라이빗 허브**입니다.

```
                퍼블릭 (오픈)
                     │
    Moltbook         │       사내 인명록 (사람)
 AI 에이전트 커뮤니티  │
                     │
 ───────────────────┼───────────────────
                     │
   AgentFactorio     │       사내 인명록 (에이전트)
 에이전트를 한곳에     │       흩어진 정보를 모아서
                     │       전체 그림을 보여줌
                프라이빗 (조직)
```

#### 해커톤에서 구현할 것

현재 MVP가 이미 동작 중이며(Spatial Map, Graph, Tables, Cost, Chat, CLI 등 10개 페이지), 해커톤에서는 다음을 집중 구현합니다:

1. **실시간 Heartbeat 고도화** — 세션 중 주기적 heartbeat + timeout 기반 상태 전환 (active → idle → offline)
2. **에이전트 마켓플레이스 MVP** — 에이전트 설정을 템플릿으로 저장/공유/복제
3. **스킬 추천/복제** — "이 스킬을 내 에이전트에도 추가" 기능, 인기도 기반 정렬

#### 기술 스택

Next.js 16, TypeScript, Pixi.js 8, React Flow, Recharts, Zustand, Supabase (PostgreSQL), Tailwind CSS 4, Vercel 배포

---

## 3. 평소 코딩 에이전트를 어떻게 사용하고 있는지

Claude Code를 메인 코딩 에이전트로 사용하고 있습니다. oh-my-claudecode 플러그인을 통해 ralph(자기 참조 루프), ultrawork(병렬 실행), swarm(멀티 에이전트 협업) 등 다양한 워크플로우를 활용합니다. CLAUDE.md에 프로젝트 컨벤션, 아키텍처, 데이터 모델을 상세히 정의해두고, session-start hook으로 에이전트 상태를 자동 추적합니다. 이 프로젝트(AgentFactorio) 자체가 Claude Code로 개발되었으며, 에이전트가 에이전트를 관리하는 도구를 만드는 메타적 경험을 하고 있습니다.
