-- ============================================================
-- REAL ESTATE CRM — Supabase Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Project: dpyvxptwrclihaxengqa
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Contact Information
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  
  -- Lead Details
  source TEXT NOT NULL DEFAULT 'walk_in' 
    CHECK (source IN ('website', 'referral', 'social_media', 'walk_in', 'cold_call', 'advertisement', 'property_portal', 'other')),
  status TEXT NOT NULL DEFAULT 'new' 
    CHECK (status IN ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost')),
  priority TEXT NOT NULL DEFAULT 'medium' 
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Property Interest
  property_type TEXT DEFAULT 'residential'
    CHECK (property_type IN ('residential', 'commercial', 'plot', 'villa', 'apartment', 'office', 'shop', 'other')),
  budget_min NUMERIC(15,2) DEFAULT 0,
  budget_max NUMERIC(15,2) DEFAULT 0,
  preferred_location TEXT,
  
  -- Assignment
  assigned_to TEXT,
  
  -- Notes
  notes TEXT,
  
  -- User tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- 2. FOLLOW_UPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Link to lead
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Follow-up details
  follow_up_date TIMESTAMPTZ NOT NULL,
  follow_up_type TEXT NOT NULL DEFAULT 'call'
    CHECK (follow_up_type IN ('call', 'meeting', 'site_visit', 'email', 'whatsapp', 'video_call', 'other')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'missed', 'rescheduled', 'cancelled')),
  
  -- Content
  title TEXT NOT NULL,
  description TEXT,
  outcome TEXT,
  
  -- User tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- 3. PROPERTIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Property Info
  title TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'residential'
    CHECK (property_type IN ('residential', 'commercial', 'plot', 'villa', 'apartment', 'office', 'shop', 'other')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'sold', 'under_negotiation', 'rented', 'blocked')),
  
  -- Location
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  pincode TEXT,
  
  -- Details
  area_sqft NUMERIC(10,2),
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  price NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  
  -- Media
  image_url TEXT,
  
  -- User tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- 4. DEALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Links
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Deal Info
  title TEXT NOT NULL,
  deal_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'proposal'
    CHECK (stage IN ('proposal', 'negotiation', 'documentation', 'closing', 'closed_won', 'closed_lost')),
  
  -- Commission
  commission_percent NUMERIC(5,2) DEFAULT 2.00,
  commission_amount NUMERIC(15,2) GENERATED ALWAYS AS (deal_value * commission_percent / 100) STORED,
  
  -- Dates
  expected_close_date DATE,
  actual_close_date DATE,
  
  -- Notes
  notes TEXT,
  
  -- User tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- 5. ACTIVITIES TABLE (Activity Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Link to entities
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Activity
  activity_type TEXT NOT NULL DEFAULT 'note'
    CHECK (activity_type IN ('note', 'call', 'email', 'meeting', 'status_change', 'deal_created', 'follow_up', 'site_visit', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  
  -- User tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);

CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);

CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see/edit their own data
-- LEADS
CREATE POLICY "Users can view own leads" ON leads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON leads
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON leads
  FOR DELETE USING (auth.uid() = user_id);

-- FOLLOW_UPS
CREATE POLICY "Users can view own follow_ups" ON follow_ups
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own follow_ups" ON follow_ups
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own follow_ups" ON follow_ups
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own follow_ups" ON follow_ups
  FOR DELETE USING (auth.uid() = user_id);

-- PROPERTIES
CREATE POLICY "Users can view own properties" ON properties
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own properties" ON properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own properties" ON properties
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own properties" ON properties
  FOR DELETE USING (auth.uid() = user_id);

-- DEALS
CREATE POLICY "Users can view own deals" ON deals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deals" ON deals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own deals" ON deals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own deals" ON deals
  FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITIES
CREATE POLICY "Users can view own activities" ON activities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activities" ON activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own activities" ON activities
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- VIEWS (for Dashboard analytics)
-- ============================================================

-- Lead stats view
CREATE OR REPLACE VIEW lead_stats AS
SELECT 
  user_id,
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
GROUP BY user_id;

-- Deal stats view
CREATE OR REPLACE VIEW deal_stats AS
SELECT
  user_id,
  COUNT(*) as total_deals,
  COUNT(*) FILTER (WHERE stage = 'closed_won') as won_deals,
  COUNT(*) FILTER (WHERE stage = 'closed_lost') as lost_deals,
  COUNT(*) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost')) as active_deals,
  COALESCE(SUM(deal_value) FILTER (WHERE stage = 'closed_won'), 0) as total_revenue,
  COALESCE(SUM(deal_value) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost')), 0) as pipeline_value,
  COALESCE(SUM(commission_amount) FILTER (WHERE stage = 'closed_won'), 0) as total_commission
FROM deals
GROUP BY user_id;

-- Monthly lead trend view
CREATE OR REPLACE VIEW monthly_lead_trend AS
SELECT
  user_id,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as lead_count,
  COUNT(*) FILTER (WHERE status = 'won') as won_count
FROM leads
GROUP BY user_id, DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ============================================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================================

-- Create a new storage bucket for property images
INSERT INTO storage.buckets (id, name, public)
VALUES ('property_images', 'property_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to property images
CREATE POLICY "Property Images Public Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'property_images' );

-- Allow authenticated users to upload property images
CREATE POLICY "Property Images Auth Insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'property_images' );

-- Allow users to update their own property images
CREATE POLICY "Property Images Auth Update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING ( bucket_id = 'property_images' );

-- Allow users to delete their own property images
CREATE POLICY "Property Images Auth Delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'property_images' );
