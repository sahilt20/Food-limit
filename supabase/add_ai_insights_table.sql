-- ============================================
-- AI Insights Cache Table
-- Stores dashboard AI analytics for each user and time period
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_insights_cache (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  period text NOT NULL, -- 'week', 'month', or 'year'
  insights jsonb NOT NULL, -- The complete AI insights data
  provider text, -- 'openai', 'gemini', 'local', etc.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure one cached insight per user per period
  UNIQUE(user_id, period)
);

-- Enable Row Level Security
ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own insights cache"
  ON public.ai_insights_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights cache"
  ON public.ai_insights_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights cache"
  ON public.ai_insights_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights cache"
  ON public.ai_insights_cache FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_period ON public.ai_insights_cache(user_id, period);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_insights_updated_at
  BEFORE UPDATE ON public.ai_insights_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_insights_updated_at();
