-- ==========================================
-- REAL ESTATE CRM: AUTOMATION & SMART FEATURES
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Smart Features: Add Lead Scoring columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'cold'));

-- 2. Automation: Communications Log (Simulated WhatsApp/Email)
CREATE TABLE IF NOT EXISTS communications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Agent who "sent" it
  
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'sms')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'scheduled', 'sent', 'delivered', 'read', 'failed')),
  
  is_automated BOOLEAN DEFAULT false
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own communications" ON communications FOR SELECT USING (true);
CREATE POLICY "Users insert communications" ON communications FOR INSERT WITH CHECK (true);

-- 3. Automation: Auto-Assign Leads Trigger
-- This function finds the agent with the fewest active leads and assigns them
CREATE OR REPLACE FUNCTION auto_assign_lead()
RETURNS TRIGGER AS $$
DECLARE
  least_busy_agent UUID;
BEGIN
  -- If lead is already assigned manually, skip
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find the agent with the fewest active (not won/lost) leads
  SELECT id INTO least_busy_agent
  FROM profiles
  WHERE role = 'agent'
  ORDER BY (
    SELECT COUNT(*) 
    FROM leads 
    WHERE assigned_to = profiles.id 
    AND status NOT IN ('won', 'lost')
  ) ASC
  LIMIT 1;

  -- If an agent is found, assign them
  IF least_busy_agent IS NOT NULL THEN
    NEW.assigned_to := least_busy_agent;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_lead ON leads;
CREATE TRIGGER trigger_auto_assign_lead
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_lead();

-- 4. Automation: Auto WhatsApp Reply Trigger (Simulated)
-- When a new lead is created, automatically log a welcome WhatsApp message
CREATE OR REPLACE FUNCTION auto_welcome_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO communications (lead_id, channel, direction, content, is_automated, status)
  VALUES (
    NEW.id, 
    'whatsapp', 
    'outbound', 
    'Hi ' || NEW.full_name || ', thanks for contacting us! An agent will be with you shortly. 🏡',
    true,
    'delivered'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_welcome ON leads;
CREATE TRIGGER trigger_auto_welcome
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_welcome_message();
