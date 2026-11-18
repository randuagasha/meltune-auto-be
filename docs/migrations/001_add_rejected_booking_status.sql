-- Migration 001: Add 'rejected' value to booking_status enum
-- Type: Additive (non-destructive)
-- Apply via: Supabase SQL Editor or psql
-- Prerequisites: schema.sql must have been applied first
--
-- Purpose: Distinguish mechanic-rejected bookings from customer-cancelled bookings.
--   pending     -> customer submitted, awaiting mechanic triage
--   confirmed   -> mechanic approved, scheduled
--   in_progress -> vehicle is on the lift
--   waiting_for_parts -> service paused pending parts
--   completed   -> service finished
--   cancelled   -> customer cancelled before service
--   rejected    -> mechanic rejected (with rejection_reason)
--
-- PostgreSQL does not support removing enum values, only adding.
-- This migration is safe to run once; running it twice will error (value already exists).

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'waiting_for_parts';
