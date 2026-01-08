-- Add columns to challenge_activities for system defaults
ALTER TABLE challenge_activities 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS required_days integer DEFAULT 7;

-- Create athlete challenge progress table
CREATE TABLE IF NOT EXISTS athlete_challenge_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  current_week integer NOT NULL DEFAULT 1,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_weeks integer[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create challenge daily marks table
CREATE TABLE IF NOT EXISTS challenge_daily_marks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  completed boolean DEFAULT true,
  completed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, week_number, day_of_week)
);

-- Enable RLS
ALTER TABLE athlete_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_daily_marks ENABLE ROW LEVEL SECURITY;

-- RLS for athlete_challenge_progress
CREATE POLICY "Athletes can view their own progress"
ON athlete_challenge_progress FOR SELECT
USING (client_id IN (SELECT id FROM clients WHERE athlete_user_id = auth.uid()));

CREATE POLICY "Athletes can manage their own progress"
ON athlete_challenge_progress FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE athlete_user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE athlete_user_id = auth.uid()));

CREATE POLICY "Admin can view all progress"
ON athlete_challenge_progress FOR SELECT
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Admin can manage all progress"
ON athlete_challenge_progress FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- RLS for challenge_daily_marks
CREATE POLICY "Athletes can view their own daily marks"
ON challenge_daily_marks FOR SELECT
USING (client_id IN (SELECT id FROM clients WHERE athlete_user_id = auth.uid()));

CREATE POLICY "Athletes can manage their own daily marks"
ON challenge_daily_marks FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE athlete_user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE athlete_user_id = auth.uid()));

CREATE POLICY "Admin can view all daily marks"
ON challenge_daily_marks FOR SELECT
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Admin can manage all daily marks"
ON challenge_daily_marks FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Insert default 6-week activities (will be created by first admin)
-- These serve as templates

-- Add updated_at trigger
CREATE TRIGGER update_athlete_challenge_progress_updated_at
BEFORE UPDATE ON athlete_challenge_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();