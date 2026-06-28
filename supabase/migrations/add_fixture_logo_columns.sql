-- Migration: Add home and away logo columns to fixtures
ALTER TABLE IF EXISTS public.fixtures
  ADD COLUMN IF NOT EXISTS home_logo_url text,
  ADD COLUMN IF NOT EXISTS away_logo_url text;
