CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'department', 'agent')),
  target_id TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX idx_announcements_org_id ON announcements(org_id);

CREATE TABLE announcement_acks (
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  acked_at TEXT NOT NULL,
  PRIMARY KEY (announcement_id, agent_id)
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_acks ENABLE ROW LEVEL SECURITY;
