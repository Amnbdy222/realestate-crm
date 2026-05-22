-- ============================================================
-- REAL ESTATE CRM: ENTERPRISE TEAM & MULTI-TENANT RLS POLICIES
-- Copy and execute this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Helper function to check if a user is an Admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(admin_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = admin_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper function to verify if an agent belongs to an admin's team
CREATE OR REPLACE FUNCTION public.is_team_member(agent_uuid UUID, admin_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = agent_uuid AND admin_id = admin_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3. EXPANDING DEALS RLS POLICIES ─────────────────────────
-- Drop all possible old and new policy variations to ensure complete idempotency
DROP POLICY IF EXISTS "Users can view own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete own deals" ON public.deals;

DROP POLICY IF EXISTS "View Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Insert Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Update Deals Policy" ON public.deals;
DROP POLICY IF EXISTS "Delete Deals Policy" ON public.deals;

CREATE POLICY "View Deals Policy" ON public.deals
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid()) OR
    is_team_member(auth.uid(), user_id)
  );

CREATE POLICY "Insert Deals Policy" ON public.deals
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Update Deals Policy" ON public.deals
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid())
  );

CREATE POLICY "Delete Deals Policy" ON public.deals
  FOR DELETE USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid())
  );


-- ── 4. EXPANDING PROPERTIES RLS POLICIES ────────────────────
-- Properties are developer inventory and should be visible to the entire team,
-- but managed strictly by the Admin.
DROP POLICY IF EXISTS "Users can view own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete own properties" ON public.properties;

DROP POLICY IF EXISTS "View Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Insert Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Update Properties Policy" ON public.properties;
DROP POLICY IF EXISTS "Delete Properties Policy" ON public.properties;

CREATE POLICY "View Properties Policy" ON public.properties
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid()) OR
    is_team_member(auth.uid(), user_id)
  );

CREATE POLICY "Insert Properties Policy" ON public.properties
  FOR INSERT WITH CHECK (
    is_org_admin(auth.uid())
  );

CREATE POLICY "Update Properties Policy" ON public.properties
  FOR UPDATE USING (
    is_org_admin(auth.uid())
  );

CREATE POLICY "Delete Properties Policy" ON public.properties
  FOR DELETE USING (
    is_org_admin(auth.uid())
  );


-- ── 5. EXPANDING FOLLOW-UPS RLS POLICIES ────────────────────
DROP POLICY IF EXISTS "Users can view own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can insert own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can update own follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Users can delete own follow_ups" ON public.follow_ups;

DROP POLICY IF EXISTS "View Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Insert Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Update Follow-Ups Policy" ON public.follow_ups;
DROP POLICY IF EXISTS "Delete Follow-Ups Policy" ON public.follow_ups;

CREATE POLICY "View Follow-Ups Policy" ON public.follow_ups
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid()) OR
    is_team_member(auth.uid(), user_id)
  );

CREATE POLICY "Insert Follow-Ups Policy" ON public.follow_ups
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Update Follow-Ups Policy" ON public.follow_ups
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid())
  );

CREATE POLICY "Delete Follow-Ups Policy" ON public.follow_ups
  FOR DELETE USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid())
  );


-- ── 6. EXPANDING TASKS RLS POLICIES ─────────────────────────
DROP POLICY IF EXISTS "Users can view their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their tasks" ON public.tasks;

DROP POLICY IF EXISTS "View Tasks Policy" ON public.tasks;
DROP POLICY IF EXISTS "Insert Tasks Policy" ON public.tasks;
DROP POLICY IF EXISTS "Update Tasks Policy" ON public.tasks;
DROP POLICY IF EXISTS "Delete Tasks Policy" ON public.tasks;

CREATE POLICY "View Tasks Policy" ON public.tasks
  FOR SELECT USING (
    auth.uid() = assigned_to OR 
    auth.uid() = created_by OR
    is_team_member(assigned_to, auth.uid()) OR
    is_team_member(created_by, auth.uid())
  );

CREATE POLICY "Insert Tasks Policy" ON public.tasks
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

CREATE POLICY "Update Tasks Policy" ON public.tasks
  FOR UPDATE USING (
    auth.uid() = assigned_to OR 
    auth.uid() = created_by OR
    is_team_member(assigned_to, auth.uid()) OR
    is_team_member(created_by, auth.uid())
  );

CREATE POLICY "Delete Tasks Policy" ON public.tasks
  FOR DELETE USING (
    auth.uid() = created_by OR
    is_team_member(created_by, auth.uid())
  );


-- ── 7. EXPANDING DOCUMENTS RLS POLICIES ─────────────────────
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

DROP POLICY IF EXISTS "View Documents Policy" ON public.documents;
DROP POLICY IF EXISTS "Insert Documents Policy" ON public.documents;
DROP POLICY IF EXISTS "Update Documents Policy" ON public.documents;
DROP POLICY IF EXISTS "Delete Documents Policy" ON public.documents;

CREATE POLICY "View Documents Policy" ON public.documents
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid()) OR
    is_team_member(auth.uid(), user_id)
  );

CREATE POLICY "Insert Documents Policy" ON public.documents
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Update Documents Policy" ON public.documents
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid())
  );

CREATE POLICY "Delete Documents Policy" ON public.documents
  FOR DELETE USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid())
  );


-- ── 8. EXPANDING ACTIVITIES RLS POLICIES ────────────────────
DROP POLICY IF EXISTS "Users can view own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete own activities" ON public.activities;

DROP POLICY IF EXISTS "View Activities Policy" ON public.activities;
DROP POLICY IF EXISTS "Insert Activities Policy" ON public.activities;
DROP POLICY IF EXISTS "Delete Activities Policy" ON public.activities;

CREATE POLICY "View Activities Policy" ON public.activities
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid()) OR
    is_team_member(auth.uid(), user_id)
  );

CREATE POLICY "Insert Activities Policy" ON public.activities
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Delete Activities Policy" ON public.activities
  FOR DELETE USING (
    auth.uid() = user_id OR 
    is_team_member(user_id, auth.uid())
  );
