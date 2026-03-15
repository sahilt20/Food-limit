-- Add AI analytics columns to grocery_sessions
ALTER TABLE public.grocery_sessions 
ADD COLUMN IF NOT EXISTS ai_summary jsonb,
ADD COLUMN IF NOT EXISTS recommendations jsonb;
