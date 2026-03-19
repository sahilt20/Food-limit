-- Migration: add expiry_date to grocery_items
-- Run this in Supabase SQL Editor or via CLI

ALTER TABLE grocery_items
ADD COLUMN IF NOT EXISTS expiry_date date;

-- Index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_grocery_items_expiry
    ON grocery_items (expiry_date)
    WHERE expiry_date IS NOT NULL;

-- Optional: A view to quickly list expiring/expired items (for future use)
CREATE OR REPLACE VIEW expiring_items AS
SELECT
    gi.id,
    gi.name,
    gi.quantity,
    gi.unit,
    gi.category,
    gi.expiry_date,
    gi.session_id,
    gs.user_id,
    gs.store_name,
    gs.session_name,
    (gi.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM grocery_items gi
JOIN grocery_sessions gs ON gs.id = gi.session_id
WHERE gi.expiry_date IS NOT NULL
ORDER BY gi.expiry_date ASC;
