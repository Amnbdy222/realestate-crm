-- ============================================================
-- ORGANIZATIONAL ONBOARDING & REGISTRATION MIGRATION
-- Copy and run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Add org_name column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_name TEXT;

-- 2. Update the trigger function to automatically populate org_name on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, admin_id, org_name)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'agent'),
    NULLIF(new.raw_user_meta_data->>'admin_id', '')::UUID,
    new.raw_user_meta_data->>'org_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
