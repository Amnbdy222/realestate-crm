-- ==========================================
-- 1. TASK MANAGEMENT
-- ==========================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium', -- low/medium/high/urgent
  status TEXT DEFAULT 'pending',  -- pending/in_progress/done
  assigned_to UUID REFERENCES auth.users,
  lead_id UUID REFERENCES leads ON DELETE CASCADE,
  deal_id UUID REFERENCES deals ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tasks" 
ON public.tasks FOR SELECT 
USING (auth.uid() = assigned_to OR auth.uid() = created_by);

CREATE POLICY "Users can insert tasks" 
ON public.tasks FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their tasks" 
ON public.tasks FOR UPDATE 
USING (auth.uid() = assigned_to OR auth.uid() = created_by);

CREATE POLICY "Users can delete their tasks" 
ON public.tasks FOR DELETE 
USING (auth.uid() = created_by);


-- ==========================================
-- 2. DRIP CAMPAIGNS
-- ==========================================

DROP TABLE IF EXISTS public.lead_campaigns CASCADE;
DROP TABLE IF EXISTS public.drip_sequences CASCADE;
DROP TABLE IF EXISTS public.drip_campaigns CASCADE;

CREATE TABLE public.drip_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.drip_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.drip_campaigns ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  delay_days INTEGER NOT NULL, -- 0 = immediate, 3 = wait 3 days after previous step
  channel TEXT NOT NULL, -- 'whatsapp', 'email', 'sms'
  template_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.lead_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.drip_campaigns ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed'
  next_execution_time TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users -- The agent who enrolled them
);

-- RLS for Campaigns (Admins and Agents can view, Admins can create)
ALTER TABLE public.drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaigns ENABLE ROW LEVEL SECURITY;

-- Everyone can view campaigns and sequences
CREATE POLICY "Anyone can view campaigns" ON public.drip_campaigns FOR SELECT USING (true);
CREATE POLICY "Anyone can view sequences" ON public.drip_sequences FOR SELECT USING (true);

-- Users can enroll leads into campaigns
CREATE POLICY "Users can manage lead enrollments" 
ON public.lead_campaigns FOR ALL 
USING (auth.uid() = user_id);

-- Only admins should manage campaigns/sequences (simplified for now to allow created_by)
CREATE POLICY "Users can manage their campaigns" 
ON public.drip_campaigns FOR ALL 
USING (auth.uid() = created_by);

CREATE POLICY "Users can manage their sequences" 
ON public.drip_sequences FOR ALL 
USING (
  campaign_id IN (SELECT id FROM public.drip_campaigns WHERE created_by = auth.uid())
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_campaigns;
