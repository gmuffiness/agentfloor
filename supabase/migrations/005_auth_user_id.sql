-- Add user_id (Supabase Auth) to org_members and organizations

ALTER TABLE org_members ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_org_members_user_org ON org_members(user_id, org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);

ALTER TABLE organizations ADD COLUMN creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
