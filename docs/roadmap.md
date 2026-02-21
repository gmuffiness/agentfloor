# Roadmap — Unimplemented Features vs. Vision

> Analysis date: 2026-02-20

## Current Implementation Status Summary

### Achievement by Core Value

| Core Value | Achievement | Status |
|-----------|--------|------|
| Visibility | 70% | Visualization well established with Spatial Map, Graph, Tables, etc. No real-time status tracking. |
| Standardization | 40% | Skill Catalog is read-only level. No sharing/recommendation/cloning features. |
| Governance | 55% | registered_by tracking and admin/member roles exist. No cost collection or audit logs. |
| Connection | 50% | Chat and Graph exist. No automated inter-agent collaboration. |

### Completion by Page

| Page | Completion | Key Gap |
|--------|--------|----------|
| Spatial Map | 90% | No real-time status reflection |
| Overview | 75% | Missing organization-wide KPI cards |
| Graph | 85% | No search/recommendation like "find agents using the same skill" |
| Org Chart | 80% | - |
| Agents Table | 85% | - |
| Departments Table | 80% | - |
| Cost | 70% | **UI is complete, but data collection pipeline is not implemented** |
| Skill Catalog | 65% | Read-only. No recommendation/sharing/cloning |
| Chat | 75% | No automated inter-agent conversations, Google vendor not supported |
| Settings | 90% | - |

---

## Unimplemented Core Features — By Priority

### Tier 1: High Impact, Low Effort (Start Immediately)

#### 1. Enhanced Real-Time Heartbeat
- **Current**: One-time PATCH sending `status="active"` on session start (`session-start.mjs:110-116`)
- **Problem**: No periodic heartbeat, no timeout-based idle/offline transitions
- **To do**:
  - Send periodic heartbeat during session (e.g., every 5 minutes)
  - Server-side timeout based on `last_active` (15 min → idle, 1 hour → offline)
  - Reflect agent status in real-time on the Spatial Map
- **Related code**: `scripts/session-start.mjs`, `status`/`last_active` columns in agents table

#### 2. Google (Gemini) Chat Support
- **Current**: Returns `"not yet supported"` at `chat/route.ts:224-226`
- **To do**: Integrate Google AI SDK
- **Note**: Vendor type `"google"` is already defined (`types/index.ts`)

#### 3. Audit Log
- **Current**: Only `registered_by` records the initial registrant. No change history.
- **To do**:
  - Add `audit_log` table (who, what, when, diff)
  - Automatically record events on agent push/update/delete
  - Add audit log viewer to Settings page

### Tier 2: High Impact, Medium Effort

#### 4. Cost Data Collection Pipeline
- **Current**: `cost_history`, `usage_history` tables exist but no data collection mechanism (`001_init.sql:106-128`)
- **Problem**: Cost page UI is well built but useless with no actual data
- **To do**:
  - Option A: Include token usage/cost data during CLI push (leverages existing pipeline, low real-time capability)
  - Option B: Integrate vendor Usage APIs (e.g., Anthropic Usage API — enables real-time tracking but more complex)
  - Budget overrun alerts (currently only a UI banner exists, no email/Slack notifications)

#### 5. Real-Time Dashboard Updates
- **Current**: `app-store.ts`'s `fetchOrganization` called once. No subscription/polling.
- **To do**:
  - Option A: Supabase Realtime subscription (instant updates, watch for Supabase plan limits)
  - Option B: 30-second polling (simple, stable)
  - Auto-update agent avatar status on the Spatial Map

#### 6. Skill Recommendation/Cloning
- **Current**: Skill Catalog is read-only (`skills/page.tsx`)
- **To do**:
  - "Add this skill to my agent too" action
  - Sorting by popularity/usage frequency
  - `agent-factorio recommend` CLI command
  - Highlight shared skills between agents

### Tier 3: High Impact, High Effort (Long-term)

#### 7. Agent Marketplace (MVP)
- **Current**: No marketplace/template/fork logic in the codebase
- **To do**:
  - Save/share/clone agent configurations as "templates"
  - New tables (`agent_templates`, `template_installs`)
  - Marketplace UI page
  - `agent-factorio clone <template-id>` CLI command
- **Scope decision**: Internal to organization only vs. cross-organization sharing

#### 8. Automated Inter-Agent Collaboration
- **Current**: Chat requires manual message sending by users. No autonomous agent interaction.
- **To do**:
  - Event-driven trigger system (Agent A completes a task → notify Agent B)
  - Borrow Moltbook's Heartbeat concept — agents periodically check/share information within the organization
  - API-based message exchange between agents (without human intervention)

#### 9. Full Multi-Vendor Support
- **Current**: Vendor type only defines 3 options: `"anthropic" | "openai" | "google"`
- **To do**:
  - Include non-API tools like Cursor, Copilot, Windsurf in the data model
  - Per-vendor agent detection/registration adapters
  - Per-vendor cost calculation logic

#### 10. Public Profile Option
- **Current**: No visibility field in organizations/agents tables
- **To do**:
  - Add `organizations.visibility` column (`public` | `private`)
  - Unauthenticated access to public org pages
  - Option to publicly expose individual agent profiles

---

## Suggested Implementation Order

```
Phase 1 (Quick Wins)
├── Enhanced Heartbeat (real-time status)
├── Google Gemini chat support
└── Audit log

Phase 2 (Core Value)
├── Cost data collection pipeline
├── Real-time dashboard updates
└── Skill recommendation/cloning

Phase 3 (Differentiators)
├── Agent marketplace MVP
├── Automated inter-agent collaboration
├── Full multi-vendor support
└── Public profile option
```
