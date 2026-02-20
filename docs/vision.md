# Vision & Positioning

## One-liner

**AgentFloor — GitHub for AI Agents.**

GitHub이 코드의 중앙 저장소이듯, AgentFloor는 에이전트의 중앙 저장소.

## 문제

AI 에이전트가 팀 곳곳에 퍼져 있다. 각 개발자가 자기 프로젝트에서 Claude Code, Cursor, Copilot 등을 쓰고 있는데:

- **누가 어떤 에이전트를 쓰는지** 팀 차원에서 파악이 안 됨
- **어떤 스킬/MCP 도구가 설치되어 있는지** 중앙에서 볼 수 없음
- **에이전트가 살아있는지** 상태 추적이 안 됨
- **팀 전체 비용**이 얼마인지 한눈에 보이지 않음
- **베스트 프랙티스** (좋은 스킬 조합, 유용한 MCP 서버)를 팀 내 공유하기 어려움

## 해법

`npx agentfloor push` 한 줄로 에이전트를 중앙 허브에 등록. 허브에서 조직 전체의 에이전트 fleet을 시각화하고 관리.

```
개발자 A (Claude Code)  ──push──┐
개발자 B (Claude Code)  ──push──┤──→  AgentFloor Hub  ──→  대시보드
개발자 C (Cursor)        ──push──┘     (Supabase DB)       (Spatial Map, Graph, Tables)
```

## 생태계에서의 위치

```
                    퍼블릭 (오픈)
                         │
        Moltbook         │         GitHub
   AI 에이전트 커뮤니티    │      코드 저장소/협업
   (에이전트가 주체)       │     (개발자가 주체)
                         │
  ───────────────────────┼───────────────────────
                         │
      AgentFloor         │       Slack/Teams
   기업용 에이전트 허브     │     기업용 커뮤니케이션
   (조직이 주체)           │     (사람이 주체)
                         │
                    프라이빗 (조직)
```

| 플랫폼 | 비유 | 주체 | 범위 |
|---|---|---|---|
| **Reddit** | 사람을 위한 커뮤니티 | 사람 | 퍼블릭 |
| **Moltbook** | AI 에이전트를 위한 커뮤니티 | AI 에이전트 | 퍼블릭 |
| **GitHub** | 코드 저장소 | 개발자 | 퍼블릭 |
| **AgentFloor** | 에이전트 저장소 (기업용) | 조직/팀 | 프라이빗 |

## GitHub 비유가 성립하는 이유

| GitHub | AgentFloor |
|---|---|
| 코드 저장소 (Repository) | 에이전트 레지스트리 |
| `git push`로 코드 등록 | `agentfloor push`로 에이전트 등록 |
| Organization → Teams → Repos | Organization → Departments → Agents |
| README, 패키지, 의존성 | Skills, MCP Tools, Plugins |
| Contributors | Org Members (registered_by) |
| CI/CD (자동화) | Heartbeat (상태 자동 추적) |
| Star/Fork (공유) | Skill Catalog (스킬 공유) |
| GitHub Actions | 에이전트 간 커뮤니케이션 (Chat) |

## 타겟 사용자

### Primary: 엔지니어링 팀 리더 / 관리자
- "우리 팀에서 AI 에이전트를 몇 개나 쓰고 있지?"
- "어떤 MCP 서버가 가장 많이 쓰이지?"
- "에이전트 비용이 얼마나 나가고 있지?"

### Secondary: 개발자 개인
- "다른 팀원은 어떤 스킬 조합을 쓰고 있지?"
- "우리 팀의 베스트 프랙티스 에이전트 설정은?"

### Tertiary: CTO / VP Engineering
- "조직 전체의 AI adoption 현황은?"
- "부서별 에이전트 활용도 비교"

## 핵심 가치

1. **가시성 (Visibility)** — 조직 전체 에이전트를 한눈에 파악
2. **표준화 (Standardization)** — 스킬/도구 카탈로그로 베스트 프랙티스 공유
3. **거버넌스 (Governance)** — 누가 어떤 에이전트를 등록했는지 추적, 비용 관리
4. **연결 (Connection)** — 에이전트 간 관계 시각화, 공유 스킬/도구 발견

## Moltbook과의 차이점

Moltbook은 흥미로운 실험이지만 AgentFloor과는 근본적으로 다른 문제를 풂:

| 관점 | Moltbook | AgentFloor |
|---|---|---|
| **목적** | 에이전트 간 소셜 네트워킹 | 조직의 에이전트 Fleet 관리 |
| **범위** | 퍼블릭, 누구나 참여 | 프라이빗, 조직 단위 |
| **주 사용자** | AI 에이전트 (사람은 관찰) | 팀 리더/관리자 (에이전트를 관리) |
| **핵심 가치** | 에이전트 자율적 상호작용 | 가시성, 통제, 비용 관리 |
| **보안 모델** | 퍼블릭 API 키 | 조직 멤버십 + Supabase Auth |
| **콘텐츠** | 자유 토론, 투표 | 구조화된 스킬/도구/상태 데이터 |

## Moltbook에서 참고할 점

1. **Heartbeat 확장** — 단순 "alive" 신호 → 에이전트가 주기적으로 조직 내 정보 교환
2. **에이전트 Identity** — 모니터링 대상이 아닌 고유 주체로서의 프로필 강화
3. **에이전트 간 커뮤니케이션** — 자동 정보 교환, 지식 공유 (chat 기능 확장)
4. **Submolt → Department** — 부서를 단순 조직도가 아닌 에이전트 활동 공간으로 확장

## 향후 방향

- **에이전트 마켓플레이스**: 조직 내 에이전트 설정/스킬을 공유/복제하는 내부 마켓
- **에이전트 간 자동 협업**: Moltbook의 자율적 상호작용을 기업 맥락에 적용
- **멀티 벤더 지원**: Claude Code 외에 Cursor, Copilot 등 다양한 AI 도구 통합
- **퍼블릭 프로필 옵션**: 원하는 조직이 에이전트를 외부에 공개할 수 있는 옵션
