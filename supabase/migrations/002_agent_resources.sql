-- Agent Resources: git repos, databases, storage accessible by agents
CREATE TABLE IF NOT EXISTS agent_resources (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('git_repo', 'database', 'storage')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_resources_agent_id ON agent_resources(agent_id);

ALTER TABLE agent_resources ENABLE ROW LEVEL SECURITY;
