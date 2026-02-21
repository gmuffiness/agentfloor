-- Merge humans table into org_members
-- org_members becomes the single source of truth for people

-- 1. Add avatar_url to org_members
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';

-- 2. Migrate avatar_url from humans to matching org_members (by name + org_id)
UPDATE org_members m
SET avatar_url = h.avatar_url
FROM humans h
WHERE h.org_id = m.org_id
  AND h.name = m.name
  AND h.avatar_url != '';

-- 3. Drop FK constraint FIRST (some human_id values may already point to org_members)
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_human_id_fkey;

-- 4. Update agents.human_id to point to matching org_members.id (only for rows still referencing humans table)
UPDATE agents a
SET human_id = m.id
FROM humans h
JOIN org_members m ON m.org_id = h.org_id AND m.name = h.name
WHERE a.human_id = h.id;

-- 5. Clear any human_id that doesn't exist in org_members (orphaned references)
UPDATE agents a
SET human_id = NULL
WHERE a.human_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.id = a.human_id);

-- 6. Add new FK constraint: agents.human_id references org_members(id)
ALTER TABLE agents ADD CONSTRAINT agents_human_id_fkey
  FOREIGN KEY (human_id) REFERENCES org_members(id) ON DELETE SET NULL;

-- 7. Drop humans table and its index
DROP INDEX IF EXISTS idx_humans_org_id;
DROP TABLE IF EXISTS humans;
