-- Drop the legacy fixtures.logo_url column now that the app uses home_logo_url and away_logo_url
ALTER TABLE IF EXISTS public.fixtures
DROP COLUMN IF EXISTS logo_url;
