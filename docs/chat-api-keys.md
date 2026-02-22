# Chat API Keys (BYOK — Bring Your Own Key)

The chat feature requires an API key to communicate with AI agents. AgentFactorio supports two levels of API key configuration: **personal (user-level)** and **organization-level**.

## Key Resolution Priority

When a user sends a chat message, the system resolves API keys in this order:

1. **User's personal key** (from `localStorage`, sent via request header)
2. **Organization-level key** (encrypted in DB, set by admin in Settings)
3. **Rejected** — returns `NO_API_KEY` error if neither is available

Environment variable fallback (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) is intentionally removed to prevent uncontrolled API cost on public/template organizations.

## Personal API Keys (User-Level)

Personal keys are stored in the user's browser via `localStorage` and are never persisted on the server.

### Storage

| Key | localStorage Key |
|-----|-----------------|
| Anthropic | `af_user_anthropic_key` |
| OpenAI | `af_user_openai_key` |

### How It Works

1. User opens the Chat page (`/org/[orgId]/chat`)
2. If no keys are configured (personal or org), the **API Key Required** panel is displayed
3. User enters their API key in the password input field and clicks **Save**
4. Key is saved to `localStorage` — persists across sessions but only on that browser
5. On each chat request, keys are sent as HTTP headers:
   - `X-User-Anthropic-Key` — for Anthropic agents
   - `X-User-OpenAI-Key` — for OpenAI agents
6. User can clear their key at any time via the **Clear** button

### Security Considerations

- Keys exist only in the user's browser (`localStorage`) — no server-side storage
- Keys are transmitted only in chat API requests over HTTPS
- Same-origin policy prevents cross-site access to `localStorage`
- XSS is the primary risk vector (same as all client-side storage) — mitigated by standard CSP headers

## Organization API Keys (Org-Level)

Organization-level keys are set by admins in the Settings page. When configured, all org members can chat without setting personal keys.

### How It Works

1. Admin navigates to Settings → API Keys section
2. Enters Anthropic and/or OpenAI keys
3. Keys are encrypted with AES-256-GCM (using `ENCRYPTION_KEY` env var) before storage
4. Stored in the `organizations` table (`anthropic_api_key`, `openai_api_key` columns)
5. On chat requests, server decrypts org keys and uses them if no user key is provided

### Template Organizations

Template (featured/public) organizations have their org-level API keys cleared by migration. Users visiting template orgs must provide their own personal API key to use the chat feature.

## API Reference

### Check Key Availability

```
GET /api/organizations/{orgId}/api-keys
```

**Response:**
```json
{
  "orgKeys": {
    "anthropic": true,
    "openai": false
  }
}
```

Returns boolean flags indicating whether org-level keys are configured. Personal keys are checked client-side via `localStorage`.

### Chat Request Headers

```
POST /api/organizations/{orgId}/chat
Headers:
  Content-Type: application/json
  X-User-Anthropic-Key: sk-ant-...  (optional)
  X-User-OpenAI-Key: sk-...          (optional)
```

### Error Response (No Key)

When no API key is available for the required vendor:

```json
{
  "error": "NO_API_KEY",
  "message": "No API key available for anthropic. Please configure your personal API key in the chat settings.",
  "vendor": "anthropic"
}
```

**Status:** `403 Forbidden`

In the SSE stream, this error is sent as:
```
data: {"error":"NO_API_KEY","message":"...","vendor":"anthropic"}
```

## UI Behavior

### Key Setup Panel

The key setup panel appears in the chat page when:
- No keys are configured (mandatory — blocks chat input)
- User clicks the settings gear icon in the conversation header (optional — for key management)

### Chat Input

When no keys are available, the chat input is disabled with placeholder text: *"Configure an API key to start chatting"*.

### Error Handling

When a `NO_API_KEY` error is received during a chat attempt:
1. The temporary user message is removed from the message list
2. An error message is displayed explaining which vendor key is missing
3. The key setup panel auto-opens for immediate configuration

## Files

| File | Description |
|------|-------------|
| `src/app/api/organizations/[orgId]/chat/route.ts` | Chat API — reads user keys from headers, priority resolution |
| `src/app/api/organizations/[orgId]/api-keys/route.ts` | API keys endpoint — GET status, PATCH to set/clear |
| `src/components/chat/ChatPage.tsx` | Chat UI — localStorage helpers, key setup panel, header injection |
| `src/components/chat/ChatInput.tsx` | Chat input — disabled state when no keys |
| `src/lib/crypto.ts` | AES-256-GCM encryption/decryption for org keys |
| `src/app/org/[orgId]/settings/page.tsx` | Settings page — org-level key management (admin only) |
| `supabase/migrations/20260222200000_clear_template_org_api_keys.sql` | Migration to clear template org keys |
