# Cost Tracking — 설계 문서

> 작성일: 2026-02-20

## 개요

조직 내 AI 서비스 비용을 자동으로 수집·관리하는 시스템. 개인은 자기 구독/사용량을 관리하고, 관리자는 조직 전체 비용을 한눈에 파악한다.

## 비용의 두 가지 축

```
                    고정 (구독)                        변동 (API/사용량)
                         │                                  │
  멤버 단위    Claude Max $200/m              Anthropic API (토큰당 과금)
               ChatGPT Plus $20/m             OpenAI API
               Cursor Pro $20/m               Google AI API
               Midjourney $30/m
                         │                                  │
  에이전트 단위    해당 없음                     에이전트별 세션당 토큰 사용량
```

- **구독형**: 사람(멤버)이 결제 → 멤버 단위로 관리
- **API형**: 에이전트가 소비 → 에이전트/세션 단위로 관리

## 벤더별 Billing/Usage API 현황

### API 사용량 자동 추적 가능

| 벤더 | API 엔드포인트 | 인증 | 지원 내용 |
|------|---------------|------|----------|
| **Anthropic** | `GET /v1/organizations/cost_report` | Admin API Key (`sk-ant-admin...`) | 일별 비용(USD), 모델/워크스페이스별 breakdown |
| | `GET /v1/organizations/usage_report/messages` | | 토큰 소비량, 5분 내 반영 |
| **OpenAI** | `GET /v1/organization/costs` | API Key | 일별 비용, 프로젝트별 필터링 |
| | `GET /v1/usage` | | 분/시간/일 단위 토큰 사용량 |
| | `GET /v1/dashboard/billing/subscription` | | 플랜/결제 주기 정보 |
| **Google** | Cloud Billing Reports API | Service Account | Cloud Billing 통해 비용 추적 |
| | | | **API 키별 사용량 분리 불가** |
| **Cursor** | Admin API | Admin API Key | 유저별 토큰/요청 수, 모델별 breakdown |
| | | | **Enterprise 티어에서만 사용 가능** |

### API 미지원 — 수동 등록

| 벤더 | 상황 | 비용 모델 |
|------|------|----------|
| **Midjourney** | 공식 API 없음 | 구독형 ($10~$120/m) |
| **Windsurf** | Billing API 없음 | 구독형 |
| **기타** | - | 이름 + 금액 직접 입력 |

### Claude Code (구독형) 특이 케이스

Claude Max/Pro 구독자는 API 과금이 아니라 고정 월정액. 사용량 추적은 가능:
- 로컬 JSONL 파일에 세션별 `input_tokens`/`output_tokens` 저장
- [ccusage](https://github.com/ryoppippi/ccusage) 같은 도구로 파싱 가능
- `/cost` 명령어로 세션 내 사용량 확인 (billing 목적은 아님)

## 3단계 자동화 전략

```
Level 1: 완전 자동 (Billing API 연동)
├── Anthropic API → Admin API Key로 cost_report 자동 수집
├── OpenAI API → Organization costs API 자동 수집
└── Cursor Enterprise → Admin API로 유저별 비용 수집

Level 2: 반자동 (로컬 감지 + push)
├── Claude Code (Max/Pro) → 로컬 JSONL에서 토큰 사용량 파싱 후 push 시 전송
└── Claude Code (API) → 세션 메타데이터에서 비용 추출 후 push 시 전송

Level 3: 수동 등록 (최후의 수단)
├── Midjourney → 구독 플랜/금액 직접 입력
├── Windsurf → 구독 플랜/금액 직접 입력
└── 기타 AI 서비스 → 이름 + 금액 직접 입력
```

## 참고 자료

- [Anthropic Usage and Cost API](https://docs.anthropic.com/en/api/usage-cost-api)
- [Anthropic Cost Reporting in Console](https://support.anthropic.com/en/articles/9534590-cost-and-usage-reporting-in-console)
- [OpenAI Usage API Reference](https://platform.openai.com/docs/api-reference/usage)
- [OpenAI Costs API Cookbook](https://cookbook.openai.com/examples/completions_usage_api)
- [Google Gemini Billing](https://ai.google.dev/gemini-api/docs/billing)
- [Cursor Admin API / Vantage Integration](https://www.vantage.sh/blog/cursor-cost-management)
- [ccusage — Claude Code Usage Analysis](https://github.com/ryoppippi/ccusage)
- [Claude Code Cost Management](https://code.claude.com/docs/en/costs)
