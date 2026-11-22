-- ==============================================================================
-- Migration 005: Create vehicles table and RLS policies
-- Apply via: Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INT NOT NULL,
    license_plate TEXT NOT NULL,
    transmission TEXT NOT NULL DEFAULT 'automatic',
    fuel_type TEXT NOT NULL DEFAULT 'petrol',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Allow customers to select their own vehicles
DROP POLICY IF EXISTS "Users read own vehicles" ON public.vehicles;
CREATE POLICY "Users read own vehicles"
    ON public.vehicles FOR SELECT
    USING (auth.uid() = user_id);

-- Allow customers to insert their own vehicles
DROP POLICY IF EXISTS "Users insert own vehicles" ON public.vehicles;
CREATE POLICY "Users insert own vehicles"
    ON public.vehicles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow customers to update their own vehicles
DROP POLICY IF EXISTS "Users update own vehicles" ON public.vehicles;
CREATE POLICY "Users update own vehicles"
    ON public.vehicles FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow customers to delete their own vehicles
DROP POLICY IF EXISTS "Users delete own vehicles" ON public.vehicles;
CREATE POLICY "Users delete own vehicles"
    ON public.vehicles FOR DELETE
    USING (auth.uid() = user_id);

-- Allow mechanics and superadmins to view all vehicles
DROP POLICY IF EXISTS "Staff read all vehicles" ON public.vehicles;
CREATE POLICY "Staff read all vehicles"
    ON public.vehicles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('mechanic', 'superadmin')
        )
    );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
