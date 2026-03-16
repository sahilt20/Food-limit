-- ============================================
-- AI Generated Content Table
-- Stores persisted AI results (recipes, meal plans, recommendations)
-- Run this in your Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_generated_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL,  -- 'recipes', 'meal_plan', 'recommendations'
  content jsonb NOT NULL,
  input_params jsonb,          -- what was used to generate (ingredients, dietary, etc.)
  provider text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(user_id, content_type)
);

ALTER TABLE public.ai_generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai content"
  ON public.ai_generated_content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai content"
  ON public.ai_generated_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai content"
  ON public.ai_generated_content FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai content"
  ON public.ai_generated_content FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_generated_user_type
  ON public.ai_generated_content(user_id, content_type);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_generated_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_generated_content_updated_at
  BEFORE UPDATE ON public.ai_generated_content
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_generated_content_updated_at();
