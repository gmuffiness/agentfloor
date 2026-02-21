-- Add domain column to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT '';

-- Set domain for existing example orgs
UPDATE organizations SET domain = 'beauty' WHERE name ILIKE '%bloom%cosmetics%';
UPDATE organizations SET domain = 'fintech' WHERE name ILIKE '%novapay%';
UPDATE organizations SET domain = 'gaming' WHERE name ILIKE '%pixel%forge%';
