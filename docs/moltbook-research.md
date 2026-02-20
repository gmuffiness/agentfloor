# Moltbook 리서치 & AgentFloor 포지셔닝 비교

> 조사일: 2026-02-20

## Moltbook이란?

**"A Social Network for AI Agents"** — AI 에이전트를 위한 Reddit 스타일 소셜 네트워크.

- **창업자**: Matt Schlicht (2026년 1월 런칭)
- **규모**: 160만+ 에이전트, 185,000+ 게시물, 140만+ 댓글 (2026년 2월 기준)
- **핵심 콘셉트**: 인간은 관찰만 가능, 게시/댓글/투표는 오직 AI 에이전트만 수행

### 주요 기능

| 기능 | 설명 |
|---|---|
| Submolts | Reddit의 subreddit에 해당하는 토픽별 커뮤니티 |
| Heartbeat | 4시간마다 에이전트가 자동으로 피드 확인 · 게시 · 댓글 |
| 에이전트 인증 | API 키 기반 인증, claim URL로 소유권 검증 |
| 피드 & 필터링 | 최신/인기/토론순 콘텐츠 정렬 |
| 개발자 플랫폼 | 외부 앱에서 Moltbook 신원으로 로그인 가능 |

### 기술 스택

- **OpenClaw** (구 Clawdbot → Moltbot → OpenClaw): 오픈소스 AI 에이전트 엔진
  - Anthropic 상표 이의로 인해 "Clawdbot"에서 이름 변경
  - 이메일, 브라우저, Spotify, 스마트홈 등 수십 개 앱 제어 가능
- **Heartbeat 시스템**: `moltbook.com/heartbeat.md`를 주기적으로 fetch → 지시 따르기
- **API**: Bearer token 인증, REST API로 게시물/댓글/투표/submolt CRUD

### 보안 이슈

- 2026년 1월 31일, 404 Media가 비인증 DB 접근 취약점 보고
- Wiz 보안회사: 수백만 개 API 토큰 노출 발견
- OpenClaw 사용 시 루트 파일, 인증 자격증명, 브라우저 히스토리 등 광범위한 권한 요구
- 일시적 서비스 중단 후 전체 API 키 리셋

### 언론 보도

- [NBC News](https://www.nbcnews.com/tech/tech-news/ai-agents-social-media-platform-moltbook-rcna256738) — "Humans welcome to observe"
- [NPR](https://www.npr.org/2026/02/04/nx-s1-5697392/moltbook-social-media-ai-agents) — "The newest social media platform — but it's just for AI bots"
- [CNBC](https://www.cnbc.com/2026/02/02/social-media-for-ai-agents-moltbook.html) — Elon Musk의 긍정적 반응과 업계 회의론
- [Engadget](https://www.engadget.com/ai/what-the-hell-is-moltbook-the-social-network-for-ai-agents-140000787.html) — 상세 해설
- [Simon Willison](https://simonwillison.net/2026/jan/30/moltbook/) — "The most interesting place on the internet right now"

---

## 포지셔닝 비교: Agent 생태계의 4분면

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

### 비유 정리

| 플랫폼 | 비유 | 주체 | 범위 |
|---|---|---|---|
| **Reddit** | 사람을 위한 커뮤니티 | 사람 | 퍼블릭 |
| **Moltbook** | AI 에이전트를 위한 커뮤니티 | AI 에이전트 | 퍼블릭 |
| **GitHub** | 코드 저장소 | 개발자 | 퍼블릭 |
| **AgentFloor** | 에이전트 저장소 (기업용) | 조직/팀 | 프라이빗 |

---

## Moltbook에서 참고할 점

### 1. 에이전트 자율성 (Heartbeat 패턴)

Moltbook의 Heartbeat 시스템은 에이전트가 4시간마다 자동으로 피드를 확인하고 활동하는 구조. AgentFloor는 이미 session-start hook으로 heartbeat를 보내고 있지만, 더 풍부한 자율적 행동을 고려할 수 있음:

- **현재 AgentFloor**: 세션 시작 시 "나 살아있어" heartbeat만 전송
- **참고 가능**: 에이전트가 주기적으로 조직 내 다른 에이전트의 상태 확인, 관련 정보 공유 등 자율적 상호작용

### 2. 에이전트 Identity & 프로필

Moltbook은 에이전트가 자체적으로 가입하고 프로필을 갖는 구조. AgentFloor도 에이전트가 단순 "모니터링 대상"이 아니라 고유한 identity를 가진 주체로 취급되는 방향을 강화할 수 있음:

- 에이전트별 활동 히스토리, 전문 분야, 성과 지표
- 에이전트 간 관계 (이미 graph 페이지에서 일부 구현)

### 3. 에이전트 간 커뮤니케이션

Moltbook의 핵심은 에이전트끼리 대화하는 것. AgentFloor의 chat 기능을 확장하여:

- 에이전트 간 자동 정보 교환 (예: "이 코드베이스에서 이런 패턴을 발견했다")
- 조직 내 에이전트 간 지식 공유 채널

### 4. Submolt → Department 매핑

Moltbook의 Submolt(토픽별 커뮤니티)는 AgentFloor의 Department 개념과 유사. Department를 단순 조직도가 아닌 에이전트들의 활동 공간으로 더 강화할 수 있음.

---

## AgentFloor만의 차별점

Moltbook과 AgentFloor는 근본적으로 다른 문제를 풀고 있음:

| 관점 | Moltbook | AgentFloor |
|---|---|---|
| **목적** | 에이전트 간 소셜 네트워킹 | 조직의 에이전트 Fleet 관리 |
| **범위** | 퍼블릭, 누구나 참여 | 프라이빗, 조직 단위 |
| **주 사용자** | AI 에이전트 (사람은 관찰) | 팀 리더/관리자 (에이전트를 관리) |
| **핵심 가치** | 에이전트 자율적 상호작용 | 가시성, 통제, 비용 관리 |
| **보안 모델** | 퍼블릭 API 키 | 조직 멤버십 + Supabase Auth |
| **콘텐츠** | 자유 토론, 투표 | 구조화된 스킬/도구/상태 데이터 |

**AgentFloor는 "GitHub for AI Agents"** — 코드가 아닌 에이전트 설정/상태/관계를 버전 관리하고 조직 전체에서 가시화하는 플랫폼.

- GitHub이 코드의 중앙 저장소이듯, AgentFloor는 에이전트의 중앙 저장소
- GitHub이 PR/Issue로 협업하듯, AgentFloor는 에이전트 간 관계/스킬 공유로 협업
- GitHub이 CI/CD로 자동화하듯, AgentFloor는 heartbeat/상태 모니터링으로 자동화

---

## 향후 고려사항

1. **에이전트 마켓플레이스**: 조직 내 에이전트 설정/스킬을 공유·복제할 수 있는 내부 마켓
2. **에이전트 간 자동 협업**: Moltbook의 자율적 상호작용을 기업 맥락에 적용
3. **퍼블릭 프로필 옵션**: 원하는 조직이 에이전트를 외부에 공개할 수 있는 옵션 (Moltbook과의 접점)
4. **OpenClaw 호환성**: OpenClaw 에이전트를 AgentFloor에 등록할 수 있는 어댑터 고려
