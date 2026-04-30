-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT, -- e.g., 'lead', 'deal', 'followup', 'system'
  read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add Row Level Security (RLS) policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
ON public.notifications 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Enable Realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 4. Create a trigger to automatically notify when a new lead is assigned
CREATE OR REPLACE FUNCTION notify_new_lead() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (
    NEW.user_id, 
    'New Lead Assigned', 
    'You have a new lead: ' || NEW.full_name, 
    'lead', 
    '/leads'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow safe re-running
DROP TRIGGER IF EXISTS on_new_lead ON public.leads;

CREATE TRIGGER on_new_lead
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION notify_new_lead();

-- 5. Optional: Create a trigger for when a Deal is Won
CREATE OR REPLACE FUNCTION notify_deal_won() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'closed_won' AND OLD.stage != 'closed_won' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.user_id, 
      'Deal Won! 🎉', 
      'Congratulations! You closed a deal for ' || COALESCE(NEW.deal_value::TEXT, 'an undisclosed amount') || '.', 
      'deal', 
      '/pipeline'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_deal_won ON public.deals;

CREATE TRIGGER on_deal_won
AFTER UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION notify_deal_won();
