# Cost Tracking — Design Document

> Written: 2026-02-20

## Overview

A system for automatically collecting and managing AI service costs within an organization. Individuals manage their own subscriptions/usage, while administrators get a comprehensive view of organization-wide costs.

## Two Dimensions of Cost

```
                    Fixed (Subscription)                Variable (API/Usage)
                         │                                  │
  Per member     Claude Max $200/m              Anthropic API (per-token billing)
                 ChatGPT Plus $20/m             OpenAI API
                 Cursor Pro $20/m               Google AI API
                 Midjourney $30/m
                         │                                  │
  Per agent      N/A                            Per-agent, per-session token usage
```

- **Subscription-based**: Paid by people (members) → managed per member
- **API-based**: Consumed by agents → managed per agent/session

## Vendor Billing/Usage API Status

### Automatic API Usage Tracking Available

| Vendor | API Endpoint | Auth | Supported Features |
|------|---------------|------|----------|
| **Anthropic** | `GET /v1/organizations/cost_report` | Admin API Key (`sk-ant-admin...`) | Daily cost (USD), breakdown by model/workspace |
| | `GET /v1/organizations/usage_report/messages` | | Token consumption, reflected within 5 minutes |
| **OpenAI** | `GET /v1/organization/costs` | API Key | Daily cost, filtering by project |
| | `GET /v1/usage` | | Token usage by minute/hour/day |
| | `GET /v1/dashboard/billing/subscription` | | Plan/billing cycle info |
| **Google** | Cloud Billing Reports API | Service Account | Cost tracking via Cloud Billing |
| | | | **Cannot separate usage by API key** |
| **Cursor** | Admin API | Admin API Key | Per-user tokens/requests, breakdown by model |
| | | | **Only available on Enterprise tier** |

### No API Support — Manual Registration

| Vendor | Situation | Cost Model |
|------|------|----------|
| **Midjourney** | No official API | Subscription ($10~$120/m) |
| **Windsurf** | No Billing API | Subscription |
| **Other** | - | Enter name + amount manually |

### Claude Code (Subscription) Special Case

Claude Max/Pro subscribers pay a fixed monthly fee, not per-API billing. Usage tracking is still possible:
- Session-level `input_tokens`/`output_tokens` stored in local JSONL files
- Can be parsed with tools like [ccusage](https://github.com/ryoppippi/ccusage)
- `/cost` command shows in-session usage (not for billing purposes)

## 3-Level Automation Strategy

```
Level 1: Fully Automatic (Billing API Integration)
├── Anthropic API → Auto-collect cost_report via Admin API Key
├── OpenAI API → Auto-collect via Organization costs API
└── Cursor Enterprise → Collect per-user costs via Admin API

Level 2: Semi-Automatic (Local Detection + Push)
├── Claude Code (Max/Pro) → Parse token usage from local JSONL and send on push
└── Claude Code (API) → Extract cost from session metadata and send on push

Level 3: Manual Registration (Last Resort)
├── Midjourney → Enter subscription plan/amount manually
├── Windsurf → Enter subscription plan/amount manually
└── Other AI services → Enter name + amount manually
```

## References

- [Anthropic Usage and Cost API](https://docs.anthropic.com/en/api/usage-cost-api)
- [Anthropic Cost Reporting in Console](https://support.anthropic.com/en/articles/9534590-cost-and-usage-reporting-in-console)
- [OpenAI Usage API Reference](https://platform.openai.com/docs/api-reference/usage)
- [OpenAI Costs API Cookbook](https://cookbook.openai.com/examples/completions_usage_api)
- [Google Gemini Billing](https://ai.google.dev/gemini-api/docs/billing)
- [Cursor Admin API / Vantage Integration](https://www.vantage.sh/blog/cursor-cost-management)
- [ccusage — Claude Code Usage Analysis](https://github.com/ryoppippi/ccusage)
- [Claude Code Cost Management](https://code.claude.com/docs/en/costs)
