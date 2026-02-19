-- Humans table: tracks human owners/operators of agents
CREATE TABLE IF NOT EXISTS humans (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_humans_org_id ON humans(org_id);
ALTER TABLE humans ENABLE ROW LEVEL SECURITY;

-- Add human_id FK to agents
ALTER TABLE agents ADD COLUMN human_id TEXT REFERENCES humans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agents_human_id ON agents(human_id);
