-- ============================================================
-- MULTI-ORGANIZATION SUPPORT MIGRATION
-- Run this in your Supabase SQL Editor AFTER all previous migrations
-- ============================================================

-- ============================================================
-- 1. ORGANIZATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update own org" ON organizations
  FOR UPDATE USING (owner_id = auth.uid());

-- Allow inserts from service role (registration API) and the trigger
CREATE POLICY "Service role can insert orgs" ON organizations
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 2. ADD org_id TO PROFILES
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- ============================================================
-- 3. ADD org_id TO ALL DATA TABLES
-- ============================================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.towers ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.channel_partners ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- These may or may not exist yet — safe to run
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 4. INDEXES FOR org_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON public.leads(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON public.deals(org_id);
CREATE INDEX IF NOT EXISTS idx_properties_org_id ON public.properties(org_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_org_id ON public.follow_ups(org_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_id ON public.activities(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_bookings_org_id ON public.bookings(org_id);
CREATE INDEX IF NOT EXISTS idx_channel_partners_org_id ON public.channel_partners(org_id);

-- ============================================================
-- 5. HELPER FUNCTION: Get the org_id for the current user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. REWRITE RLS POLICIES — ORG-SCOPED ISOLATION
-- ============================================================

-- ── LEADS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
DROP POLICY IF EXISTS "View Leads Policy" ON public.leads;
DROP POLICY IF EXISTS "Update Leads Policy" ON public.leads;
DROP POLICY IF EXISTS "Delete Leads Policy" ON public.leads;

CREATE POLICY "Org View Leads" ON public.leads
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Leads" ON public.leads
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Leads" ON public.leads
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Leads" ON public.leads
  FOR DELETE USING (org_id = get_user_org_id());

-- ── DEALS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete own deals" ON public.deals;
DROP POLICY IF EXISTS "View Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Insert Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Update Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Delete Deals Policy" ON public.deals;

CREATE POLICY "Org View Deals" ON public.deals
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Deals" ON public.deals
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Deals" ON public.deals
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Deals" ON public.deals
  FOR DELETE USING (org_id = get_user_org_id());

-- ── PROPERTIES ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete own properties" ON public.properties;
DROP POLICY IF EXISTS "View Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Insert Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Update Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Delete Properties Policy" ON public.properties;

CREATE POLICY "Org View Properties" ON public.properties
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Properties" ON public.properties
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Properties" ON public.properties
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Properties" ON public.properties
  FOR DELETE USING (org_id = get_user_org_id());

-- ── FOLLOW-UPS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can insert own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can update own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can delete own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "View Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Insert Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Update Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Delete Follow-Ups Policy" ON public.follow_ups;

CREATE POLICY "Org View Follow-Ups" ON public.follow_ups
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Follow-Ups" ON public.follow_ups
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Follow-Ups" ON public.follow_ups
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Follow-Ups" ON public.follow_ups
  FOR DELETE USING (org_id = get_user_org_id());

-- ── ACTIVITIES ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete own activities" ON public.activities;
DROP POLICY IF EXISTS "View Activities Policy" ON public.activities;
DROP POLICY IF EXISTS "Insert Activities Policy" ON public.activities;
DROP POLICY IF EXISTS "Delete Activities Policy" ON public.activities;

CREATE POLICY "Org View Activities" ON public.activities
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Activities" ON public.activities
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Delete Activities" ON public.activities
  FOR DELETE USING (org_id = get_user_org_id());

-- ── PROJECTS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Auth Users Select Projects" ON public.projects;
DROP POLICY IF EXISTS "Auth Users Insert Projects" ON public.projects;

CREATE POLICY "Org View Projects" ON public.projects
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Projects" ON public.projects
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Projects" ON public.projects
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Projects" ON public.projects
  FOR DELETE USING (org_id = get_user_org_id());

-- ── TOWERS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Auth Users Select Towers" ON public.towers;
DROP POLICY IF EXISTS "Auth Users Insert Towers" ON public.towers;

CREATE POLICY "Org View Towers" ON public.towers
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Towers" ON public.towers
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Towers" ON public.towers
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Towers" ON public.towers
  FOR DELETE USING (org_id = get_user_org_id());

-- ── UNITS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Auth Users Select Units" ON public.units;
DROP POLICY IF EXISTS "Auth Users Insert Units" ON public.units;
DROP POLICY IF EXISTS "Auth Users Update Units" ON public.units;

CREATE POLICY "Org View Units" ON public.units
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Units" ON public.units
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Units" ON public.units
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Units" ON public.units
  FOR DELETE USING (org_id = get_user_org_id());

-- ── BOOKINGS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Auth Users Select Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Auth Users Insert Bookings" ON public.bookings;

CREATE POLICY "Org View Bookings" ON public.bookings
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert Bookings" ON public.bookings
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update Bookings" ON public.bookings
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete Bookings" ON public.bookings
  FOR DELETE USING (org_id = get_user_org_id());

-- ── CHANNEL PARTNERS ────────────────────────────────────────
DROP POLICY IF EXISTS "Auth Users Select CPs" ON public.channel_partners;
DROP POLICY IF EXISTS "Auth Users Insert CPs" ON public.channel_partners;

CREATE POLICY "Org View CPs" ON public.channel_partners
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Org Insert CPs" ON public.channel_partners
  FOR INSERT WITH CHECK (org_id = get_user_org_id());

CREATE POLICY "Org Update CPs" ON public.channel_partners
  FOR UPDATE USING (org_id = get_user_org_id());

CREATE POLICY "Org Delete CPs" ON public.channel_partners
  FOR DELETE USING (org_id = get_user_org_id());

-- ── DOCUMENTS (if exists) ───────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
  DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
  DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
  DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
  DROP POLICY IF EXISTS "View Documents Policy" ON public.documents;
  DROP POLICY IF EXISTS "Insert Documents Policy" ON public.documents;
  DROP POLICY IF EXISTS "Update Documents Policy" ON public.documents;
  DROP POLICY IF EXISTS "Delete Documents Policy" ON public.documents;

  CREATE POLICY "Org View Documents" ON public.documents FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Documents" ON public.documents FOR INSERT WITH CHECK (org_id = get_user_org_id());
  CREATE POLICY "Org Update Documents" ON public.documents FOR UPDATE USING (org_id = get_user_org_id());
  CREATE POLICY "Org Delete Documents" ON public.documents FOR DELETE USING (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── TASKS (if exists) ───────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "View Tasks Policy" ON public.tasks;
  DROP POLICY IF EXISTS "Insert Tasks Policy" ON public.tasks;
  DROP POLICY IF EXISTS "Update Tasks Policy" ON public.tasks;
  DROP POLICY IF EXISTS "Delete Tasks Policy" ON public.tasks;

  CREATE POLICY "Org View Tasks" ON public.tasks FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Tasks" ON public.tasks FOR INSERT WITH CHECK (org_id = get_user_org_id());
  CREATE POLICY "Org Update Tasks" ON public.tasks FOR UPDATE USING (org_id = get_user_org_id());
  CREATE POLICY "Org Delete Tasks" ON public.tasks FOR DELETE USING (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── COMMUNICATIONS (if exists) ──────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Org View Communications" ON public.communications FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Communications" ON public.communications FOR INSERT WITH CHECK (org_id = get_user_org_id());
  CREATE POLICY "Org Update Communications" ON public.communications FOR UPDATE USING (org_id = get_user_org_id());
  CREATE POLICY "Org Delete Communications" ON public.communications FOR DELETE USING (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── NOTIFICATIONS (if exists) ───────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Org View Notifications" ON public.notifications FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Notifications" ON public.notifications FOR INSERT WITH CHECK (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 7. UPDATE handle_new_user TRIGGER
-- Now expects org_id in metadata (set by registration API)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, admin_id, org_name, org_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'agent'),
    NULLIF(new.raw_user_meta_data->>'admin_id', '')::UUID,
    new.raw_user_meta_data->>'org_name',
    NULLIF(new.raw_user_meta_data->>'org_id', '')::UUID
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. UPDATE lead_stats VIEW to be org-aware
-- ============================================================
CREATE OR REPLACE VIEW lead_stats AS
SELECT 
  user_id,
  org_id,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE status = 'new') as new_leads,
  COUNT(*) FILTER (WHERE status = 'contacted') as contacted_leads,
  COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
  COUNT(*) FILTER (WHERE status = 'negotiation') as negotiation_leads,
  COUNT(*) FILTER (WHERE status = 'won') as won_leads,
  COUNT(*) FILTER (WHERE status = 'lost') as lost_leads,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'won')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
  ) as conversion_rate
FROM leads
GROUP BY user_id, org_id;

-- ============================================================
-- 9. UPDATE deal_stats VIEW to be org-aware
-- ============================================================
CREATE OR REPLACE VIEW deal_stats AS
SELECT
  user_id,
  org_id,
  COUNT(*) as total_deals,
  COUNT(*) FILTER (WHERE stage = 'closed_won') as won_deals,
  COUNT(*) FILTER (WHERE stage = 'closed_lost') as lost_deals,
  COUNT(*) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost')) as active_deals,
  COALESCE(SUM(deal_value) FILTER (WHERE stage = 'closed_won'), 0) as total_revenue,
  COALESCE(SUM(deal_value) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost')), 0) as pipeline_value,
  COALESCE(SUM(commission_amount) FILTER (WHERE stage = 'closed_won'), 0) as total_commission
FROM deals
GROUP BY user_id, org_id;

-- ============================================================
-- 10. UPDATE auto_assign_lead to be org-aware
-- ============================================================
CREATE OR REPLACE FUNCTION auto_assign_lead() RETURNS TRIGGER AS $$
DECLARE
  selected_agent UUID;
BEGIN
  -- Only auto-assign if it's not already assigned
  IF NEW.assigned_to IS NULL AND NEW.org_id IS NOT NULL THEN
    
    -- Find the agent in the SAME ORG with the fewest active leads
    SELECT p.id INTO selected_agent
    FROM public.profiles p
    LEFT JOIN public.leads l ON l.assigned_to = p.id AND l.status NOT IN ('won', 'lost')
    WHERE p.org_id = NEW.org_id AND p.role = 'agent'
    GROUP BY p.id
    ORDER BY COUNT(l.id) ASC
    LIMIT 1;

    -- If we found an agent, assign it
    IF selected_agent IS NOT NULL THEN
      NEW.assigned_to := selected_agent;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DONE — Run this migration, then deploy the updated app code
-- ============================================================
