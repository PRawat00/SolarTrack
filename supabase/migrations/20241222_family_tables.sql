-- ==================================================
-- Family Tables Migration for SolarTrack
-- Run this in your Supabase SQL Editor
-- ==================================================

-- ============ FAMILIES TABLE ============
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_families_owner ON families(owner_id);

-- ============ FAMILY MEMBERS TABLE ============
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)  -- One family per user
);

CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);

-- ============ FAMILY INVITES TABLE ============
CREATE TABLE IF NOT EXISTS family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,  -- NULL = never expires
  max_uses INTEGER,        -- NULL = unlimited
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_invites_family ON family_invites(family_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_token ON family_invites(token);

-- ============ FAMILY IMAGES TABLE ============
CREATE TABLE IF NOT EXISTS family_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'tagged', 'claimed', 'processing', 'processed', 'error')),
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  readings_count INTEGER DEFAULT 0,
  error_message TEXT,
  table_regions JSONB,
  tagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tagged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_images_family ON family_images(family_id);
CREATE INDEX IF NOT EXISTS idx_family_images_uploader ON family_images(uploader_id);
CREATE INDEX IF NOT EXISTS idx_family_images_status ON family_images(family_id, status);

-- ============ ENABLE ROW LEVEL SECURITY ============
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_images ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES: FAMILIES ============

-- SELECT: Users can view their own family
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  USING (
    id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- INSERT: Any authenticated user can create a family (if not already in one)
CREATE POLICY "Authenticated users can create families"
  ON families FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM family_members WHERE user_id = auth.uid())
  );

-- UPDATE: Only owner can update family
CREATE POLICY "Owners can update their family"
  ON families FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE: Only owner can delete family
CREATE POLICY "Owners can delete their family"
  ON families FOR DELETE
  USING (owner_id = auth.uid());

-- ============ RLS POLICIES: FAMILY_MEMBERS ============

-- SELECT: Family members can see all members in their family
CREATE POLICY "Members can view family members"
  ON family_members FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- INSERT: Allow self-insert as owner when creating family, or via service role for invites
CREATE POLICY "Users can join as owner or member"
  ON family_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- UPDATE: Members can update their own display_name
CREATE POLICY "Members can update their own info"
  ON family_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Members can leave, owners can remove others
CREATE POLICY "Members can leave or be removed by owner"
  ON family_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM families
      WHERE families.id = family_members.family_id
      AND families.owner_id = auth.uid()
    )
  );

-- ============ RLS POLICIES: FAMILY_INVITES ============

-- SELECT: Family members can view invites, anyone can validate active tokens
CREATE POLICY "Members can view family invites"
  ON family_invites FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR (is_active = true AND (expires_at IS NULL OR expires_at > NOW()))
  );

-- INSERT: Only family members can create invites
CREATE POLICY "Members can create invites"
  ON family_invites FOR INSERT
  WITH CHECK (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

-- UPDATE: Family members can update invites (for incrementing use_count)
CREATE POLICY "Members can update invites"
  ON family_invites FOR UPDATE
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR is_active = true  -- Allow updating active invites for use_count increment
  );

-- DELETE: Only owner can delete invites
CREATE POLICY "Owners can delete invites"
  ON family_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM families
      WHERE families.id = family_invites.family_id
      AND families.owner_id = auth.uid()
    )
  );

-- ============ RLS POLICIES: FAMILY_IMAGES ============

-- SELECT: Family members can view all images in their family
CREATE POLICY "Members can view family images"
  ON family_images FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- INSERT: Family members can upload images
CREATE POLICY "Members can upload images"
  ON family_images FOR INSERT
  WITH CHECK (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    AND uploader_id = auth.uid()
  );

-- UPDATE: Family members can update images (claim, process, tag)
CREATE POLICY "Members can update family images"
  ON family_images FOR UPDATE
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- DELETE: Uploader or owner can delete images
CREATE POLICY "Uploader or owner can delete images"
  ON family_images FOR DELETE
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM families
      WHERE families.id = family_images.family_id
      AND families.owner_id = auth.uid()
    )
  );

-- ============ TRIGGER: Update updated_at ============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
