-- One-off diagnostic: find paid advert placements that silently never went live.
-- Run via:  supabase db execute --file supabase/reconcile_advert_placements.sql
-- Shows payments that completed ('advert'/'featured_boost') but whose related
-- banner still has active=false — i.e. rows the old webhook never activated.

SELECT
  p.id              AS payment_id,
  p.created_at      AS paid_at,
  p.payment_type,
  p.amount,
  p.mpesa_ref,
  p.description,
  p.related_ad_id   AS related_banner_id,
  a.title           AS banner_title,
  a.slot,
  a.active          AS banner_active,
  a.billing_start,
  a.billing_end,
  s.id              AS related_service_ad,
  s.service_name,
  s.payment_confirmed
FROM payments p
LEFT JOIN advertisements a ON a.id = p.related_ad_id::uuid
LEFT JOIN service_ads s     ON s.id = p.related_ad_id::uuid
WHERE p.status = 'completed'
  AND p.payment_type IN ('advert', 'featured_boost')
ORDER BY p.created_at DESC;