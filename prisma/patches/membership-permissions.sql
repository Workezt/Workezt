BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE public."Membership"
  ADD COLUMN IF NOT EXISTS "permissionsOverride" jsonb;
COMMIT;
