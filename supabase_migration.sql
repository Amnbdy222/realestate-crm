-- ==========================================
-- REAL ESTATE CRM: TEAM MANAGEMENT MIGRATION
-- Copy and run this in the Supabase SQL Editor
-- ==========================================

-- 1. Create Profiles Table for Role-Based Access
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, admin_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'agent'),
    NULLIF(new.raw_user_meta_data->>'admin_id', '')::UUID
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Update Leads Table to support strict assignment
-- Rename old text column to preserve data if any
ALTER TABLE leads RENAME COLUMN assigned_to TO assigned_to_text;
ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Update Leads RLS Policies
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON leads;

CREATE POLICY "View Leads Policy" ON leads
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = assigned_to OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Update Leads Policy" ON leads
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    auth.uid() = assigned_to OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Delete Leads Policy" ON leads
  FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Note: In a production app you'd repeat the RLS updates for Deals, Properties, and Follow_ups, 
-- but we'll focus on Leads for this Team Assignment feature.
