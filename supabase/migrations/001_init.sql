-- AgentFloor: Supabase PostgreSQL schema
-- Migrated from SQLite/Drizzle schema

-- ── Organizations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_budget DOUBLE PRECISION NOT NULL DEFAULT 0,
  invite_code TEXT UNIQUE,
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- ── Org Members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  joined_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);

-- ── Departments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  budget DOUBLE PRECISION NOT NULL DEFAULT 0,
  monthly_spend DOUBLE PRECISION NOT NULL DEFAULT 0,
  primary_vendor TEXT NOT NULL DEFAULT 'anthropic',
  layout_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  layout_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  layout_w DOUBLE PRECISION NOT NULL DEFAULT 300,
  layout_h DOUBLE PRECISION NOT NULL DEFAULT 240,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments(org_id);

-- ── Agents ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  dept_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  vendor TEXT NOT NULL DEFAULT 'anthropic',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idle',
  monthly_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  pos_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  pos_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_active TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_dept_id ON agents(dept_id);

-- ── Skills ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'generation'
);

-- ── Agent ↔ Skill (many-to-many) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

-- ── Plugins ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  enabled BOOLEAN NOT NULL DEFAULT true,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plugins_agent_id ON plugins(agent_id);

-- ── MCP Tools ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  server TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'api',
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_agent_id ON mcp_tools(agent_id);

-- ── Cost History ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_history (
  id TEXT PRIMARY KEY,
  dept_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  anthropic DOUBLE PRECISION NOT NULL DEFAULT 0,
  openai DOUBLE PRECISION NOT NULL DEFAULT 0,
  google DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cost_history_dept_id ON cost_history(dept_id);

-- ── Usage History ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_history (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_usage_history_agent_id ON usage_history(agent_id);

-- ── Enable Row Level Security (tables are accessed via service role key) ────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so no policies needed for server-side access
