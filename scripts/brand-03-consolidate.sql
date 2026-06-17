-- Brand refactor — Phase 3a ownership consolidation (idempotent, transactional).
-- Repoints ownership of every brand-tagged row to the single operator (Pak Budi),
-- so the console has ONE owner and brand_id is the segmentation. Only rows that
-- already carry a brand_id are touched (brand mapping preserved; nothing orphaned).
-- Apply AFTER brand-02-data.sql.
BEGIN;

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM admins WHERE is_operator;
  IF n <> 1 THEN RAISE EXCEPTION 'need exactly 1 operator, got %', n; END IF;
END $$;

UPDATE servers       SET owner_admin_id    = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE brand_id IS NOT NULL AND owner_admin_id    IS DISTINCT FROM (SELECT id FROM admins WHERE is_operator LIMIT 1);
UPDATE qris_accounts SET owner_admin_id    = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE brand_id IS NOT NULL AND owner_admin_id    IS DISTINCT FROM (SELECT id FROM admins WHERE is_operator LIMIT 1);
UPDATE agents        SET admin_id          = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE brand_id IS NOT NULL AND admin_id          IS DISTINCT FROM (SELECT id FROM admins WHERE is_operator LIMIT 1);
UPDATE customers     SET provider_admin_id = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE brand_id IS NOT NULL AND provider_admin_id IS DISTINCT FROM (SELECT id FROM admins WHERE is_operator LIMIT 1);

COMMIT;
