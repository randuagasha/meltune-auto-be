-- Migration 002: Create workshop_settings table
-- Type: Additive (non-destructive)
-- Apply via: Supabase SQL Editor or psql
-- Prerequisites: schema.sql must have been applied first
--
-- Stores operational configuration for the single MELTUNE AUTO workshop.
-- Only one row (id = 1) is maintained.

CREATE TABLE IF NOT EXISTS workshop_settings (
    id INT PRIMARY KEY DEFAULT 1,
    workshop_name TEXT NOT NULL DEFAULT 'MELTUNE AUTO Service & Parts',
    address TEXT NOT NULL DEFAULT 'Kawasan Otomotif BSD Blok B3 No. 12, Tangerang Selatan, Banten 15310',
    phone TEXT NOT NULL DEFAULT '+62 21 5590 8820',
    whatsapp TEXT NOT NULL DEFAULT '+62 811 9876 543',
    operating_hours TEXT NOT NULL DEFAULT 'Senin - Sabtu: 08:30 - 17:30 WIB (Minggu Libur)',
    max_bookings_per_slot INT NOT NULL DEFAULT 2,
    daily_checkin_base_points INT NOT NULL DEFAULT 15,
    daily_streak_bonus_multiplier INT NOT NULL DEFAULT 5,
    max_streak_bonus_points INT NOT NULL DEFAULT 25,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE workshop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workshop settings read authenticated"
    ON workshop_settings FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Workshop settings superadmin write"
    ON workshop_settings FOR ALL
    USING (auth.user_role() = 'superadmin');

INSERT INTO workshop_settings (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
