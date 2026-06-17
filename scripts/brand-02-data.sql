-- Brand refactor — Phase 2 data migration (idempotent, transactional).
-- Creates one Brand per existing provider-admin, owned by the single operator,
-- then backfills brand_id on servers/qris_accounts/agents/customers from each
-- row's current owner. Safe to re-run. Apply AFTER brand-01-schema.sql.
BEGIN;

-- Guard: exactly one operator (the single console owner, e.g. Pak Budi).
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM admins WHERE is_operator;
  IF n <> 1 THEN RAISE EXCEPTION 'expected exactly 1 operator, got %', n; END IF;
END $$;

-- 1) One Brand per provider-admin (any admin that owns data), owned by the operator.
WITH op AS (SELECT id FROM admins WHERE is_operator LIMIT 1),
provider_admins AS (
  SELECT DISTINCT aid FROM (
    SELECT owner_admin_id aid FROM servers WHERE owner_admin_id IS NOT NULL
    UNION SELECT owner_admin_id FROM qris_accounts WHERE owner_admin_id IS NOT NULL
    UNION SELECT admin_id FROM agents WHERE admin_id IS NOT NULL
    UNION SELECT provider_admin_id FROM customers WHERE provider_admin_id IS NOT NULL
  ) t WHERE aid IS NOT NULL
)
INSERT INTO brands (owner_admin_id, name, slug, is_active, sort_order, created_at, updated_at)
SELECT (SELECT id FROM op),
       COALESCE(a.brand_name, a.name),
       NULLIF(trim(both '-' from regexp_replace(lower(COALESCE(a.brand_name, a.name)), '[^a-z0-9]+', '-', 'g')), ''),
       true, a.id, now(), now()
FROM provider_admins pa JOIN admins a ON a.id = pa.aid
WHERE NOT EXISTS (
  SELECT 1 FROM brands b WHERE b.owner_admin_id = (SELECT id FROM op)
    AND b.name = COALESCE(a.brand_name, a.name));

-- 2) Backfill brand_id from each row's current owner (map old admin → brand by name).
UPDATE servers s SET brand_id = b.id
  FROM admins a JOIN brands b ON b.name = COALESCE(a.brand_name, a.name) AND b.owner_admin_id = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE s.owner_admin_id = a.id AND s.brand_id IS NULL;
UPDATE qris_accounts q SET brand_id = b.id
  FROM admins a JOIN brands b ON b.name = COALESCE(a.brand_name, a.name) AND b.owner_admin_id = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE q.owner_admin_id = a.id AND q.brand_id IS NULL;
UPDATE agents g SET brand_id = b.id
  FROM admins a JOIN brands b ON b.name = COALESCE(a.brand_name, a.name) AND b.owner_admin_id = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE g.admin_id = a.id AND g.brand_id IS NULL;
UPDATE customers c SET brand_id = b.id
  FROM admins a JOIN brands b ON b.name = COALESCE(a.brand_name, a.name) AND b.owner_admin_id = (SELECT id FROM admins WHERE is_operator LIMIT 1)
  WHERE c.provider_admin_id = a.id AND c.brand_id IS NULL;

COMMIT;
