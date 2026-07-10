-- Remove trigger and function that rely on pg_net (schema `net`) which may not be available
-- This prevents updates from failing with "schema 'net' does not exist" errors.

DROP TRIGGER IF EXISTS careers_status_change_notify ON careers_applications;
DROP FUNCTION IF EXISTS notify_careers_status_change();
