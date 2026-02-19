-- Add parent_id to departments for hierarchical org structure
-- NULL parent_id = top-level department
ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id);
