-- ==============================================================================
-- Migration 004: Supabase Storage Bucket & RLS Policies for vehicle-problems
-- Apply via: Supabase SQL Editor
--
-- Creates the public bucket 'vehicle-problems' for customer problem photos
-- and sets up safe row level security policies for upload and read access.
-- ==============================================================================

-- 1. Create the bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'vehicle-problems',
    'vehicle-problems',
    true,
    5242880, -- 5MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Allow public read access to vehicle problem photos
CREATE POLICY "Public read vehicle-problems bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'vehicle-problems');

-- 3. Allow authenticated users to upload problem photos
CREATE POLICY "Authenticated users upload vehicle-problems"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'vehicle-problems'
        AND auth.role() = 'authenticated'
    );

-- 4. Allow users or staff to delete their uploaded photos if needed
CREATE POLICY "Users and staff manage vehicle-problems"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'vehicle-problems'
        AND (
            auth.uid() = owner
            OR auth.user_role() IN ('mechanic', 'superadmin')
        )
    );
