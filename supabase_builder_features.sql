-- ==========================================
-- REAL ESTATE CRM: BUILDER & DEVELOPER EXTENSION
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  total_area TEXT,
  status TEXT DEFAULT 'under_construction' CHECK (status IN ('pre_launch', 'under_construction', 'ready_to_move', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. TOWERS / BLOCKS
CREATE TABLE IF NOT EXISTS towers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Tower A"
  total_floors INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. INVENTORY (UNITS/FLATS)
CREATE TABLE IF NOT EXISTS units (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tower_id UUID REFERENCES towers(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL, -- e.g., "402"
  floor_number INTEGER NOT NULL,
  bhk_type TEXT NOT NULL, -- e.g., "2 BHK", "3 BHK"
  carpet_area NUMERIC(10,2),
  base_price NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'blocked', 'booked', 'sold')),
  
  -- Price sheet breakdown
  floor_rise_charge NUMERIC(15,2) DEFAULT 0,
  amenities_charge NUMERIC(15,2) DEFAULT 0,
  total_price NUMERIC(15,2) GENERATED ALWAYS AS (base_price + floor_rise_charge + amenities_charge) STORED,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. CHANNEL PARTNERS
CREATE TABLE IF NOT EXISTS channel_partners (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agency_name TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  rera_number TEXT,
  commission_percent NUMERIC(5,2) DEFAULT 2.00,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 5. BOOKINGS & TOKENS
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  cp_id UUID REFERENCES channel_partners(id) ON DELETE SET NULL, -- Null if direct sale
  token_amount NUMERIC(15,2) NOT NULL,
  booking_date DATE NOT NULL,
  status TEXT DEFAULT 'token_received' CHECK (status IN ('token_received', 'agreement_done', 'registered', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_towers_updated_at BEFORE UPDATE ON towers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cp_updated_at BEFORE UPDATE ON channel_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE towers ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to interact (Simple policies for now)
CREATE POLICY "Auth Users Select Projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth Users Select Towers" ON towers FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Towers" ON towers FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth Users Select Units" ON units FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Units" ON units FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth Users Update Units" ON units FOR UPDATE USING (true);
CREATE POLICY "Auth Users Select CPs" ON channel_partners FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert CPs" ON channel_partners FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth Users Select Bookings" ON bookings FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Bookings" ON bookings FOR INSERT WITH CHECK (true);
