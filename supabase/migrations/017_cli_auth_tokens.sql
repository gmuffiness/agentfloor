-- CLI authentication tokens for persistent CLI sessions
CREATE TABLE cli_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  member_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cli_auth_tokens_token ON cli_auth_tokens (token);
ALTER TABLE cli_auth_tokens ENABLE ROW LEVEL SECURITY;
