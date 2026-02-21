# AgentFactorio CLI

`npx agent-factorio` — 어떤 프로젝트에서든 에이전트를 허브에 등록하고 관리하는 CLI 도구.

## Quick Start

```bash
# 1. 허브에 로그인 (이메일 인증 + 조직 생성/참여)
npx agent-factorio login

# 2. 현재 프로젝트의 에이전트를 허브에 등록
npx agent-factorio push
```

이후 대시보드에서 등록된 에이전트를 확인할 수 있습니다.

---

## Commands

### `agent-factorio login`

허브에 연결하고 이메일 인증 후 조직에 참여하거나 새 조직을 생성합니다.

```
$ npx agent-factorio login
? AgentFactorio Hub URL [https://agent-factorio.vercel.app]:
✓ Hub connected.

? Your email (used as your identifier): alice@example.com
ℹ Sending verification email...
✓ Verification email sent!
ℹ Check your inbox and click the verification link.
  Waiting for verification...
✓ Email verified!

? Your name (displayed in the org) [CLI User]: Alice

? Create or join an organization?
  1. Create new
  2. Join existing (invite code)
Choice: 1

? Organization name: Acme Corp
✓ Created "Acme Corp" (org-12345)
ℹ Invite code: C2M2XF — share with your team!

Logged in! Run `agent-factorio push` in any project to register an agent.
```

**동작:**
1. Hub URL 입력 (기본값: `https://agent-factorio.vercel.app`, self-host면 직접 입력)
2. 이메일 인증 (magic link)
3. 조직 생성 또는 초대 코드로 참여
4. 인증 토큰 발급 + 글로벌 config 저장

**여러 조직:**
- `login`을 여러 번 실행하면 `organizations` 배열에 추가
- `org switch`로 기본 조직 변경 가능

---

### `agent-factorio push`

현재 프로젝트의 에이전트 설정을 자동 감지하여 허브에 등록합니다.

```
$ npx agent-factorio push

Detecting agent configuration...
  Git repo:     git@github.com:user/my-project.git
  Skills:       code-review, testing (2)
  MCP servers:  github, slack (2)
  CLAUDE.md:    found (.claude/CLAUDE.md)

? Agent name [my-project]: my-project
? Vendor
  1. anthropic
  2. openai
  3. google
Choice: 1
? Model
  1. claude-opus-4-6
  2. claude-sonnet-4-6
  3. claude-haiku-4-5-20251001
Choice: 1

ℹ Pushing to "Acme Corp" at https://agent-factorio.vercel.app...
✓ Agent registered! (agent-17345678)
```

**자동 감지 항목:**

| 항목 | 소스 |
|------|------|
| Git repo URL | `git remote get-url origin` |
| Skills | `.claude/commands/*.md`, `.claude/skills/**/*.md`, `skills/**/*.md` |
| MCP servers | `.claude/settings.local.json`, `.claude/settings.json`의 `mcpServers` |
| CLAUDE.md | `.claude/CLAUDE.md` 또는 루트 `CLAUDE.md` |

**업데이트:**
- 이미 등록된 에이전트가 있으면 (`.agent-factorio/config.json`에 `agentId` 존재) 자동으로 업데이트
- MCP tools, context(CLAUDE.md) 모두 갱신
- 중복 에이전트 생성 없음

---

### `agent-factorio status`

현재 프로젝트의 등록 상태를 확인합니다.

```
$ npx agent-factorio status

Agent Status
  Agent ID:      agent-17345678
  Agent name:    my-project
  Vendor:        anthropic
  Model:         claude-opus-4-6
  Organization:  Acme Corp
  Hub URL:       https://agent-factorio.vercel.app
  Last pushed:   2026-02-19T11:51:00.000Z

✓ Agent is registered.
```

---

### `agent-factorio whoami`

로그인 정보를 확인합니다.

```
$ npx agent-factorio whoami

Login Info

  Organization:  Acme Corp (default)
  Org ID:        org-12345
  Hub URL:       https://agent-factorio.vercel.app
  Invite code:   C2M2XF
  Member name:   Alice
```

---

### `agent-factorio logout`

글로벌 config를 삭제합니다.

```
$ npx agent-factorio logout
✓ Logged out. Global config removed.
```

---

## Organization Commands

`agent-factorio org <subcommand>` — 조직을 생성, 참여, 조회, 전환합니다.

### `org list`

소속된 모든 조직을 조회합니다.

```
$ npx agent-factorio org list

Organizations

  Acme Corp (default)
    ID:           org-12345
    Role:         admin
    Invite Code:  C2M2XF
    Members:      5
    Agents:       12

  Side Project
    ID:           org-67890
    Role:         member
    Invite Code:  X9K4PL
    Members:      2
    Agents:       3
```

### `org create [name]`

새 조직을 생성합니다. 이름을 인자로 전달하거나 프롬프트에서 입력합니다.

```
$ npx agent-factorio org create "My Team"
✓ Created "My Team" (org-99999)
ℹ Invite code: H7J3KM — share with your team!
```

### `org join [inviteCode]`

초대 코드로 기존 조직에 참여합니다.

```
$ npx agent-factorio org join C2M2XF
✓ Joined "Acme Corp" (org-12345)
```

### `org switch`

여러 조직에 속해 있을 때, 기본 조직을 변경합니다.

```
$ npx agent-factorio org switch
? Select default organization
  1. Acme Corp (current)
  2. Side Project
Choice: 2
✓ Default organization set to "Side Project" (org-67890)
```

### `org info`

현재 기본 조직의 상세 정보를 조회합니다.

```
$ npx agent-factorio org info

Organization

  Name:         Acme Corp
  ID:           org-12345
  Role:         admin
  Invite Code:  C2M2XF
  Members:      5
  Agents:       12
  Hub:          https://agent-factorio.vercel.app
```

---

## Agent Commands

`agent-factorio agent <subcommand>` — 에이전트를 조회, 수정, 동기화, 삭제합니다.

모든 명령어에서 `[id]`를 생략하면 현재 프로젝트의 `.agent-factorio/config.json`에 저장된 에이전트가 사용됩니다.

### `agent list`

현재 기본 조직의 에이전트 목록을 조회합니다.

```
$ npx agent-factorio agent list

Agents in "Acme Corp"

  NAME            VENDOR      MODEL               STATUS    DEPARTMENT
  my-project      anthropic   claude-opus-4-6     active    Engineering
  data-pipeline   openai      gpt-4o              active    Data
  chatbot         anthropic   claude-sonnet-4-6   idle      Support

  3 agent(s) total
```

### `agent info [id]`

에이전트 상세 정보를 조회합니다 (skills, MCP tools, context, resources 포함).

```
$ npx agent-factorio agent info

Agent: my-project

  ID:           agent-17345678
  Vendor:       anthropic
  Model:        claude-opus-4-6
  Status:       active
  Description:  Pushed via CLI
  Department:   Engineering
  Runtime:      api
  Last Active:  2026-02-21T10:30:00.000Z

  Skills
    - code-review (generation)
    - testing (generation)

  MCP Tools
    - github [github]
    - slack [slack]

  Resources
    - git_repo: user/my-project (git@github.com:user/my-project.git)
```

### `agent edit [id]`

에이전트 속성을 수정합니다. 옵션으로 변경할 필드를 지정합니다.

```bash
# 이름과 모델 변경
npx agent-factorio agent edit --name "my-agent-v2" --model "claude-sonnet-4-6"

# 특정 에이전트 ID 지정
npx agent-factorio agent edit agent-17345678 --vendor openai --model gpt-4o

# 사용 가능한 옵션
#   --name <name>         에이전트 이름
#   --vendor <vendor>     벤더 (anthropic, openai, google 등)
#   --model <model>       모델
#   --description <desc>  설명
#   --status <status>     상태 (active, idle, error)
```

로컬 프로젝트의 에이전트를 수정하면 `.agent-factorio/config.json`도 자동 업데이트됩니다.

### `agent pull [id]`

허브에서 에이전트 설정을 가져와 로컬 `.agent-factorio/config.json`에 동기화합니다.

```
$ npx agent-factorio agent pull
✓ Synced agent "my-project" to local config.
  Agent:   my-project
  Vendor:  anthropic
  Model:   claude-opus-4-6
  Status:  active
```

다른 사람이 대시보드에서 에이전트 설정을 변경했을 때 로컬에 반영하고 싶을 때 사용합니다.

### `agent delete [id]`

에이전트를 삭제합니다. 확인 프롬프트가 표시됩니다.

```
$ npx agent-factorio agent delete
? Delete agent "my-project"? This cannot be undone [y/N]: y
✓ Agent "my-project" deleted successfully
  Local config removed.
```

---

## Config Files

### 글로벌 config: `~/.agent-factorio/config.json`

`login` 명령어로 생성. 모든 프로젝트에서 공유.

```json
{
  "organizations": [
    {
      "hubUrl": "https://agent-factorio.vercel.app",
      "orgId": "org-12345",
      "orgName": "Acme Corp",
      "inviteCode": "C2M2XF",
      "memberName": "Alice",
      "email": "alice@example.com",
      "memberId": "member-12345",
      "userId": "uuid-...",
      "authToken": "hex-token-..."
    }
  ],
  "defaultOrg": "org-12345"
}
```

- `authToken`: 로그인 시 발급. `org`, `agent` 명령어의 인증에 사용
- `defaultOrg`: `org switch`로 변경 가능

### 프로젝트 config: `.agent-factorio/config.json`

`push` 명령어로 생성. 해당 프로젝트에만 적용. **gitignore에 추가 권장.**

```json
{
  "hubUrl": "https://agent-factorio.vercel.app",
  "orgId": "org-12345",
  "agentId": "agent-17345678",
  "agentName": "my-project",
  "vendor": "anthropic",
  "model": "claude-opus-4-6",
  "pushedAt": "2026-02-21T10:30:00.000Z"
}
```

---

## CLI API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/cli/login` | POST | None | 이메일 인증, 조직 생성/참여. authToken 발급 |
| `/api/cli/push` | POST | None | 에이전트 등록/업데이트 |
| `/api/cli/orgs` | GET | Bearer token | 소속 조직 목록 |
| `/api/cli/agents` | GET | Bearer token | 조직 내 에이전트 목록 (`?orgId=X`) |
| `/api/cli/agents/:id` | GET | Bearer token | 에이전트 상세 |
| `/api/cli/agents/:id` | PATCH | Bearer token | 에이전트 수정 |
| `/api/cli/agents/:id` | DELETE | Bearer token | 에이전트 삭제 |

인증이 필요한 엔드포인트는 `Authorization: Bearer <authToken>` 헤더를 사용합니다.

---

## File Structure

```
cli/
  bin.js                   # Entry point
  commands/
    login.mjs              # login command
    push.mjs               # push command
    status.mjs             # status command
    whoami.mjs             # whoami command
    logout.mjs             # logout command
    connect.mjs            # connect command
    org.mjs                # org list/create/join/switch/info
    agent.mjs              # agent list/info/edit/pull/delete
  lib/
    config.mjs             # Global/local config read/write
    detect.mjs             # Auto-detect (git, skills, MCP, CLAUDE.md)
    api.mjs                # Hub API call helper (apiCall, authApiCall)
    prompt.mjs             # Interactive prompts (ask, choose, confirm)
    log.mjs                # Colored output utilities
```

---

## Troubleshooting

**`Cannot connect to hub`**
- 허브가 실행 중인지 확인 (`pnpm dev` 또는 배포된 URL)
- Hub URL이 올바른지 확인 (프로토콜 포함: `http://` 또는 `https://`)

**`Not logged in`**
- `agent-factorio login`을 먼저 실행
- `~/.agent-factorio/config.json` 파일이 존재하는지 확인

**`Auth token missing`**
- 이전 버전에서 로그인했다면 토큰이 없을 수 있음
- `agent-factorio login`을 다시 실행하면 새 토큰 발급

**`No departments exist`**
- CLI push는 부서가 없으면 자동으로 "Engineering" 부서를 생성

**`Invalid invite code`**
- 초대 코드가 정확한지 확인 (대소문자 무관, 6자리)
- 해당 조직이 허브에 존재하는지 확인

**`No agent ID specified`**
- `agent info`, `agent edit` 등은 ID를 생략하면 로컬 config의 agentId를 사용
- 프로젝트 루트에서 실행하거나, ID를 직접 지정: `agent info agent-12345`
