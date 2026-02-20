# Roadmap — 비전 대비 미구현 기능 분석

> 분석일: 2026-02-20

## 현재 구현 상태 요약

### 핵심 가치별 달성도

| 핵심 가치 | 달성도 | 상태 |
|-----------|--------|------|
| 가시성 (Visibility) | 70% | Spatial Map, Graph, Tables 등 시각화 잘 갖춰짐. 실시간 상태 추적 부재. |
| 표준화 (Standardization) | 40% | Skill Catalog 읽기 전용 수준. 공유/추천/복제 기능 없음. |
| 거버넌스 (Governance) | 55% | registered_by 추적, admin/member 역할 존재. 비용 수집/감사 로그 부재. |
| 연결 (Connection) | 50% | Chat, Graph 존재. 에이전트 간 자동 협업 없음. |

### 페이지별 완성도

| 페이지 | 완성도 | 핵심 Gap |
|--------|--------|----------|
| Spatial Map | 90% | 실시간 상태 반영 없음 |
| Overview | 75% | 조직 전체 KPI 카드 부족 |
| Graph | 85% | "같은 스킬 쓰는 에이전트 찾기" 등 검색/추천 없음 |
| Org Chart | 80% | - |
| Agents Table | 85% | - |
| Departments Table | 80% | - |
| Cost | 70% | **UI는 완성, 데이터 수집 파이프라인 미구현** |
| Skill Catalog | 65% | 읽기 전용. 추천/공유/복제 없음 |
| Chat | 75% | 에이전트 간 자동 대화 없음, Google 벤더 미지원 |
| Settings | 90% | - |

---

## 미구현 핵심 기능 — 우선순위순

### Tier 1: 높은 Impact, 낮은 Effort (바로 착수)

#### 1. 실시간 Heartbeat 고도화
- **현재**: 세션 시작 시 1회성 PATCH로 `status="active"` 전송 (`session-start.mjs:110-116`)
- **문제**: 주기적 heartbeat 없음, timeout 기반 idle/offline 전환 없음
- **해야 할 것**:
  - 세션 중 주기적 heartbeat 전송 (예: 5분 간격)
  - 서버에서 `last_active` 기준 timeout 판단 (15분 → idle, 1시간 → offline)
  - Spatial Map에서 에이전트 상태 실시간 반영
- **관련 코드**: `scripts/session-start.mjs`, agents 테이블의 `status`/`last_active` 컬럼

#### 2. Google (Gemini) 채팅 지원
- **현재**: `chat/route.ts:224-226`에서 `"not yet supported"` 반환
- **해야 할 것**: Google AI SDK 연동
- **참고**: Vendor 타입은 이미 `"google"` 정의됨 (`types/index.ts`)

#### 3. 감사 로그 (Audit Log)
- **현재**: `registered_by`만 최초 등록자 기록. 변경 이력 없음
- **해야 할 것**:
  - `audit_log` 테이블 추가 (who, what, when, diff)
  - agent push/update/delete 시 이벤트 자동 기록
  - Settings 페이지에 감사 로그 뷰어 추가

### Tier 2: 높은 Impact, 중간 Effort

#### 4. 비용 데이터 수집 파이프라인
- **현재**: `cost_history`, `usage_history` 테이블 존재하나 데이터 수집 메커니즘 없음 (`001_init.sql:106-128`)
- **문제**: Cost 페이지 UI는 잘 만들어져 있으나 실제 데이터가 비어 있어 무용지물
- **해야 할 것**:
  - 옵션 A: CLI push 시 토큰 사용량/비용 데이터 포함 (기존 파이프라인 활용, 실시간성 낮음)
  - 옵션 B: 벤더별 Usage API 연동 (Anthropic Usage API 등, 실시간 추적 가능하나 복잡)
  - 예산 초과 시 알림 (현재 UI 배너만 존재, 이메일/슬랙 알림 없음)

#### 5. 대시보드 실시간 갱신
- **현재**: `app-store.ts`의 `fetchOrganization` 1회 호출. 구독/polling 없음
- **해야 할 것**:
  - 옵션 A: Supabase Realtime 구독 (즉시 반영, Supabase 플랜 제한 주의)
  - 옵션 B: 30초 polling (단순, 안정적)
  - Spatial Map에서 에이전트 아바타 상태 자동 업데이트

#### 6. 스킬 추천/복제 기능
- **현재**: Skill Catalog는 읽기 전용 (`skills/page.tsx`)
- **해야 할 것**:
  - "이 스킬을 내 에이전트에도 추가" 액션
  - 인기도/사용 빈도 기반 정렬
  - CLI에서 `agentfloor recommend` 명령어
  - 에이전트 간 공유 스킬 하이라이트

### Tier 3: 높은 Impact, 높은 Effort (장기)

#### 7. 에이전트 마켓플레이스 (MVP)
- **현재**: 코드베이스에 marketplace/template/fork 관련 로직 없음
- **해야 할 것**:
  - 에이전트 설정을 "템플릿"으로 저장/공유/복제
  - 새 테이블 (`agent_templates`, `template_installs`)
  - 마켓플레이스 UI 페이지
  - CLI에서 `agentfloor clone <template-id>` 명령어
- **범위 결정**: 조직 내부만 vs 조직 간 공유

#### 8. 에이전트 간 자동 협업
- **현재**: Chat은 사용자가 수동으로 메시지 전송. 에이전트 자율적 상호작용 없음
- **해야 할 것**:
  - 이벤트 기반 트리거 시스템 (에이전트 A가 특정 작업 완료 → 에이전트 B에 알림)
  - Moltbook의 Heartbeat 개념 차용 — 에이전트가 주기적으로 조직 내 정보 확인/공유
  - 에이전트 간 API 기반 메시지 교환 (사람 개입 없이)

#### 9. 멀티 벤더 완전 지원
- **현재**: Vendor 타입이 `"anthropic" | "openai" | "google"` 3종만 정의
- **해야 할 것**:
  - Cursor, Copilot, Windsurf 등 비-API 도구도 데이터 모델에 포함
  - 벤더별 에이전트 감지/등록 어댑터
  - 벤더별 비용 계산 로직

#### 10. 퍼블릭 프로필 옵션
- **현재**: organizations/agents 테이블에 visibility 필드 없음
- **해야 할 것**:
  - `organizations.visibility` 컬럼 추가 (`public` | `private`)
  - 비인증 접근 가능한 퍼블릭 org 페이지
  - 개별 에이전트 프로필 퍼블릭 공개 옵션

---

## 구현 순서 제안

```
Phase 1 (Quick Wins)
├── Heartbeat 고도화 (실시간 상태)
├── Google Gemini 채팅 지원
└── 감사 로그

Phase 2 (Core Value)
├── 비용 데이터 수집 파이프라인
├── 대시보드 실시간 갱신
└── 스킬 추천/복제

Phase 3 (Differentiators)
├── 에이전트 마켓플레이스 MVP
├── 에이전트 간 자동 협업
├── 멀티 벤더 완전 지원
└── 퍼블릭 프로필 옵션
```
