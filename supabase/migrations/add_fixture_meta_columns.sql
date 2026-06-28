-- Migration: Add title and description columns to fixtures
ALTER TABLE IF EXISTS public.fixtures
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text;
