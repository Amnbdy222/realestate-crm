-- ============================================================
-- 1. FIX THE handle_new_user TRIGGER FUNCTION
-- This ensures when a new user registers (admin or agent), 
-- their org_id is correctly mapped from metadata to profiles.
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
-- 1B. DEFINE HELPER FUNCTION: Get org_id for the current user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 2. SECURE THE PROFILES TABLE
-- Drop permissive "viewable by everyone" policies and restrict to same org
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable in same org" ON public.profiles;

CREATE POLICY "Profiles viewable in same org" ON public.profiles
  FOR SELECT USING (org_id = get_user_org_id());

-- Keep standard self-management policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- ============================================================
-- 3. ENSURE ALL OTHER DATA TABLES HAVE RLS ENABLED
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.towers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_partners ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ============================================================
-- 4. CLEAN UP ALL OLD SINGLE-TENANT POLICIES (DROP)
-- ============================================================

-- Leads
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
DROP POLICY IF EXISTS "View Leads Policy" ON public.leads;
DROP POLICY IF EXISTS "Update Leads Policy" ON public.leads;
DROP POLICY IF EXISTS "Delete Leads Policy" ON public.leads;
DROP POLICY IF EXISTS "Org View Leads" ON public.leads;
DROP POLICY IF EXISTS "Org Insert Leads" ON public.leads;
DROP POLICY IF EXISTS "Org Update Leads" ON public.leads;
DROP POLICY IF EXISTS "Org Delete Leads" ON public.leads;

-- Deals
DROP POLICY IF EXISTS "Users can view own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete own deals" ON public.deals;
DROP POLICY IF EXISTS "View Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Insert Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Update Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Delete Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Org View Deals" ON public.deals;
DROP POLICY IF EXISTS "Org Insert Deals" ON public.deals;
DROP POLICY IF EXISTS "Org Update Deals" ON public.deals;
DROP POLICY IF EXISTS "Org Delete Deals" ON public.deals;

-- Properties
DROP POLICY IF EXISTS "Users can view own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete own properties" ON public.properties;
DROP POLICY IF EXISTS "View Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Insert Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Update Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Delete Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Org View Properties" ON public.properties;
DROP POLICY IF EXISTS "Org Insert Properties" ON public.properties;
DROP POLICY IF EXISTS "Org Update Properties" ON public.properties;
DROP POLICY IF EXISTS "Org Delete Properties" ON public.properties;

-- Follow-Ups
DROP POLICY IF EXISTS "Users can view own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can insert own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can update own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can delete own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "View Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Insert Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Update Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Delete Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Org View Follow-Ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Org Insert Follow-Ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Org Update Follow-Ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Org Delete Follow-Ups" ON public.follow_ups;

-- Activities
DROP POLICY IF EXISTS "Users can view own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete own activities" ON public.activities;
DROP POLICY IF EXISTS "View Activities Policy" ON public.activities;
DROP POLICY IF EXISTS "Insert Activities Policy" ON public.activities;
DROP POLICY IF EXISTS "Delete Activities Policy" ON public.activities;
DROP POLICY IF EXISTS "Org View Activities" ON public.activities;
DROP POLICY IF EXISTS "Org Insert Activities" ON public.activities;
DROP POLICY IF EXISTS "Org Delete Activities" ON public.activities;

-- Projects
DROP POLICY IF EXISTS "Auth Users Select Projects" ON public.projects;
DROP POLICY IF EXISTS "Auth Users Insert Projects" ON public.projects;
DROP POLICY IF EXISTS "Org View Projects" ON public.projects;
DROP POLICY IF EXISTS "Org Insert Projects" ON public.projects;
DROP POLICY IF EXISTS "Org Update Projects" ON public.projects;
DROP POLICY IF EXISTS "Org Delete Projects" ON public.projects;

-- Towers
DROP POLICY IF EXISTS "Auth Users Select Towers" ON public.towers;
DROP POLICY IF EXISTS "Auth Users Insert Towers" ON public.towers;
DROP POLICY IF EXISTS "Org View Towers" ON public.towers;
DROP POLICY IF EXISTS "Org Insert Towers" ON public.towers;
DROP POLICY IF EXISTS "Org Update Towers" ON public.towers;
DROP POLICY IF EXISTS "Org Delete Towers" ON public.towers;

-- Units
DROP POLICY IF EXISTS "Auth Users Select Units" ON public.units;
DROP POLICY IF EXISTS "Auth Users Insert Units" ON public.units;
DROP POLICY IF EXISTS "Auth Users Update Units" ON public.units;
DROP POLICY IF EXISTS "Org View Units" ON public.units;
DROP POLICY IF EXISTS "Org Insert Units" ON public.units;
DROP POLICY IF EXISTS "Org Update Units" ON public.units;
DROP POLICY IF EXISTS "Org Delete Units" ON public.units;

-- Bookings
DROP POLICY IF EXISTS "Auth Users Select Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Auth Users Insert Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Org View Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Org Insert Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Org Update Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Org Delete Bookings" ON public.bookings;

-- Channel Partners
DROP POLICY IF EXISTS "Auth Users Select CPs" ON public.channel_partners;
DROP POLICY IF EXISTS "Auth Users Insert CPs" ON public.channel_partners;
DROP POLICY IF EXISTS "Org View CPs" ON public.channel_partners;
DROP POLICY IF EXISTS "Org Insert CPs" ON public.channel_partners;
DROP POLICY IF EXISTS "Org Update CPs" ON public.channel_partners;
DROP POLICY IF EXISTS "Org Delete CPs" ON public.channel_partners;

-- Documents (Safe Drop)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
  DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
  DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
  DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
  DROP POLICY IF EXISTS "View Documents Policy" ON public.documents;
  DROP POLICY IF EXISTS "Insert Documents Policy" ON public.documents;
  DROP POLICY IF EXISTS "Update Documents Policy" ON public.documents;
  DROP POLICY IF EXISTS "Delete Documents Policy" ON public.documents;
  DROP POLICY IF EXISTS "Org View Documents" ON public.documents;
  DROP POLICY IF EXISTS "Org Insert Documents" ON public.documents;
  DROP POLICY IF EXISTS "Org Update Documents" ON public.documents;
  DROP POLICY IF EXISTS "Org Delete Documents" ON public.documents;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Tasks (Safe Drop)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can insert tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can delete their tasks" ON public.tasks;
  DROP POLICY IF EXISTS "View Tasks Policy" ON public.tasks;
  DROP POLICY IF EXISTS "Insert Tasks Policy" ON public.tasks;
  DROP POLICY IF EXISTS "Update Tasks Policy" ON public.tasks;
  DROP POLICY IF EXISTS "Delete Tasks Policy" ON public.tasks;
  DROP POLICY IF EXISTS "Org View Tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Org Insert Tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Org Update Tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Org Delete Tasks" ON public.tasks;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Communications (Safe Drop)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Org View Communications" ON public.communications;
  DROP POLICY IF EXISTS "Org Insert Communications" ON public.communications;
  DROP POLICY IF EXISTS "Org Update Communications" ON public.communications;
  DROP POLICY IF EXISTS "Org Delete Communications" ON public.communications;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Notifications (Safe Drop)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Org View Notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Org Insert Notifications" ON public.notifications;
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ============================================================
-- 5. CREATE CLEAN ORG-ISOLATED POLICIES FOR ALL TABLES
-- ============================================================

-- Leads
CREATE POLICY "Org View Leads" ON public.leads FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Leads" ON public.leads FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Leads" ON public.leads FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Leads" ON public.leads FOR DELETE USING (org_id = get_user_org_id());

-- Deals
CREATE POLICY "Org View Deals" ON public.deals FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Deals" ON public.deals FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Deals" ON public.deals FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Deals" ON public.deals FOR DELETE USING (org_id = get_user_org_id());

-- Properties
CREATE POLICY "Org View Properties" ON public.properties FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Properties" ON public.properties FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Properties" ON public.properties FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Properties" ON public.properties FOR DELETE USING (org_id = get_user_org_id());

-- Follow-Ups
CREATE POLICY "Org View Follow-Ups" ON public.follow_ups FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Follow-Ups" ON public.follow_ups FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Follow-Ups" ON public.follow_ups FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Follow-Ups" ON public.follow_ups FOR DELETE USING (org_id = get_user_org_id());

-- Activities
CREATE POLICY "Org View Activities" ON public.activities FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Activities" ON public.activities FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Delete Activities" ON public.activities FOR DELETE USING (org_id = get_user_org_id());

-- Projects
CREATE POLICY "Org View Projects" ON public.projects FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Projects" ON public.projects FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Projects" ON public.projects FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Projects" ON public.projects FOR DELETE USING (org_id = get_user_org_id());

-- Towers
CREATE POLICY "Org View Towers" ON public.towers FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Towers" ON public.towers FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Towers" ON public.towers FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Towers" ON public.towers FOR DELETE USING (org_id = get_user_org_id());

-- Units
CREATE POLICY "Org View Units" ON public.units FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Units" ON public.units FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Units" ON public.units FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Units" ON public.units FOR DELETE USING (org_id = get_user_org_id());

-- Bookings
CREATE POLICY "Org View Bookings" ON public.bookings FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert Bookings" ON public.bookings FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update Bookings" ON public.bookings FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete Bookings" ON public.bookings FOR DELETE USING (org_id = get_user_org_id());

-- Channel Partners
CREATE POLICY "Org View CPs" ON public.channel_partners FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Org Insert CPs" ON public.channel_partners FOR INSERT WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "Org Update CPs" ON public.channel_partners FOR UPDATE USING (org_id = get_user_org_id());
CREATE POLICY "Org Delete CPs" ON public.channel_partners FOR DELETE USING (org_id = get_user_org_id());

-- Documents (Safe Create)
DO $$ BEGIN
  CREATE POLICY "Org View Documents" ON public.documents FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Documents" ON public.documents FOR INSERT WITH CHECK (org_id = get_user_org_id());
  CREATE POLICY "Org Update Documents" ON public.documents FOR UPDATE USING (org_id = get_user_org_id());
  CREATE POLICY "Org Delete Documents" ON public.documents FOR DELETE USING (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Tasks (Safe Create)
DO $$ BEGIN
  CREATE POLICY "Org View Tasks" ON public.tasks FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Tasks" ON public.tasks FOR INSERT WITH CHECK (org_id = get_user_org_id());
  CREATE POLICY "Org Update Tasks" ON public.tasks FOR UPDATE USING (org_id = get_user_org_id());
  CREATE POLICY "Org Delete Tasks" ON public.tasks FOR DELETE USING (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Communications (Safe Create)
DO $$ BEGIN
  CREATE POLICY "Org View Communications" ON public.communications FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Communications" ON public.communications FOR INSERT WITH CHECK (org_id = get_user_org_id());
  CREATE POLICY "Org Update Communications" ON public.communications FOR UPDATE USING (org_id = get_user_org_id());
  CREATE POLICY "Org Delete Communications" ON public.communications FOR DELETE USING (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Notifications (Safe Create)
DO $$ BEGIN
  CREATE POLICY "Org View Notifications" ON public.notifications FOR SELECT USING (org_id = get_user_org_id());
  CREATE POLICY "Org Insert Notifications" ON public.notifications FOR INSERT WITH CHECK (org_id = get_user_org_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;
