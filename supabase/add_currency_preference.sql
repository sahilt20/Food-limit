-- Add currency_preference column to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency_preference text DEFAULT 'USD';

-- Optional comment explaining the column
COMMENT ON COLUMN public.profiles.currency_preference IS 'User''s preferred local currency code (e.g., USD, EUR, INR).';
