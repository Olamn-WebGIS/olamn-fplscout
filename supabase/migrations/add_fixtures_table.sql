-- Migration: Add fixtures table
-- Creates a fixtures table to store live match information
CREATE TABLE IF NOT EXISTS public.fixtures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  home_team text NOT NULL,
  away_team text NOT NULL,
  logo_url text,
  match_time timestamptz NOT NULL,
  live_link text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_fixtures_updated_at'
  ) THEN
    CREATE TRIGGER update_fixtures_updated_at
    BEFORE UPDATE ON public.fixtures
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();
  END IF;
END
$$;

-- Index on match_time for ordering queries
CREATE INDEX IF NOT EXISTS idx_fixtures_match_time ON public.fixtures (match_time);
