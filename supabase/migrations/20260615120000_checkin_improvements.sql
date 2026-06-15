ALTER TABLE checkin_questions ADD COLUMN IF NOT EXISTS is_adjustment_trigger BOOLEAN DEFAULT false;
ALTER TABLE checkin_feedbacks ADD COLUMN IF NOT EXISTS admin_decision TEXT;
