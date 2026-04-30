-- 1. Function and Trigger for Lead Scoring
CREATE OR REPLACE FUNCTION calculate_lead_score() RETURNS TRIGGER AS $$
DECLARE
  base_score INTEGER := 10;
  total_score INTEGER := 0;
BEGIN
  total_score := base_score;

  -- Add points for budget
  IF NEW.budget_max > 0 OR NEW.budget_min > 0 THEN
    total_score := total_score + 20;
  END IF;

  -- Add points for priority
  IF NEW.priority IN ('high', 'urgent') THEN
    total_score := total_score + 20;
  END IF;

  -- Add points for source
  IF NEW.source IN ('website', 'property_portal', 'referral') THEN
    total_score := total_score + 15;
  END IF;

  -- (Note: Site visits would be calculated via a separate trigger on follow_ups or updated via an Edge function. 
  -- For now, this is the core lead data scoring).

  -- Cap at 100
  IF total_score > 100 THEN
    total_score := 100;
  END IF;

  NEW.score := total_score;

  -- Set temperature based on score
  IF total_score >= 70 THEN
    NEW.temperature := 'hot';
  ELSIF total_score >= 40 THEN
    NEW.temperature := 'warm';
  ELSE
    NEW.temperature := 'cold';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_calculate_lead_score ON public.leads;

CREATE TRIGGER trigger_calculate_lead_score
BEFORE INSERT OR UPDATE OF budget_max, budget_min, priority, source ON public.leads
FOR EACH ROW EXECUTE FUNCTION calculate_lead_score();

-- We also want it to run on the very first insert regardless of specific columns
DROP TRIGGER IF EXISTS trigger_calculate_lead_score_insert ON public.leads;
CREATE TRIGGER trigger_calculate_lead_score_insert
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION calculate_lead_score();


-- 2. Function and Trigger for Auto-Assignment (Least Busy Agent)
CREATE OR REPLACE FUNCTION auto_assign_lead() RETURNS TRIGGER AS $$
DECLARE
  selected_agent UUID;
BEGIN
  -- Only auto-assign if it's not already assigned
  IF NEW.assigned_to IS NULL THEN
    
    -- Find the agent belonging to the creator's org (admin_id) with the fewest active leads
    SELECT p.id INTO selected_agent
    FROM public.profiles p
    LEFT JOIN public.leads l ON l.assigned_to = p.id AND l.status NOT IN ('won', 'lost')
    WHERE p.admin_id = NEW.user_id AND p.role = 'agent'
    GROUP BY p.id
    ORDER BY COUNT(l.id) ASC
    LIMIT 1;

    -- If we found an agent, assign it
    IF selected_agent IS NOT NULL THEN
      NEW.assigned_to := selected_agent;
      
      -- We can optionally create a notification for the agent here too
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (
        selected_agent, 
        'New Auto-Assigned Lead', 
        'You have been auto-assigned a new lead: ' || NEW.full_name, 
        'lead', 
        '/leads'
      );
      
    ELSE
      -- Fallback: assign to the creator
      NEW.assigned_to := NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_assign_lead ON public.leads;

CREATE TRIGGER trigger_auto_assign_lead
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION auto_assign_lead();
