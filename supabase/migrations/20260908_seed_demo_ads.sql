-- DEMO SEED: realistic sample advertisements so the team can preview every placement.
-- Rows carry owner_id = NULL on purpose (corporate/admin-created demo placements).
-- Delete before public launch:  DELETE FROM advertisements WHERE owner_id IS NULL;

INSERT INTO advertisements (
  title, image_url, description, cta_text, whatsapp_number,
  is_affiliate, active, featured, boost_until, sort_order, slot,
  billing_cycle, billing_start, billing_end, corporate_tier
) VALUES
  (
    'Sunjin Salon & Spa — Kikuyu',
    'https://picsum.photos/seed/sunjin/1200/400',
    'Braids, nails, facials & full body massage from KES 500. Walk-ins welcome daily 8am–8pm. Free parking at Kikuyu Stage.',
    'Book Now',
    '254722123456',
    false, true, true, NOW() + INTERVAL '7 days', 0, 'homepage_banner',
    '30 days', NOW(), NOW() + INTERVAL '30 days', NULL
  ),
  (
    'Itukarua Hardware Ltd',
    'https://picsum.photos/seed/itukarua-hw/1200/400',
    'Cement, roofing sheets, paint, timber & all building materials. County-wide delivery within 24 hours.',
    'Order Online',
    '254733234567',
    false, true, true, NOW() + INTERVAL '7 days', 1, 'homepage_banner',
    '30 days', NOW(), NOW() + INTERVAL '30 days', NULL
  ),
  (
    'Kikuyu Fresh Produce',
    'https://picsum.photos/seed/kikuyu-fresh/1200/400',
    'Farm-fresh sukuma, tomatoes, cabbages & fruits delivered daily to households and shambas around Kikuyu & Ndenderu.',
    'Order Today',
    '254744345678',
    false, true, true, NOW() + INTERVAL '7 days', 2, 'homepage_banner',
    '30 days', NOW(), NOW() + INTERVAL '30 days', NULL
  ),
  (
    'Mwiki Auto Garage',
    'https://picsum.photos/seed/mwiki-garage/1200/400',
    'Vehicle servicing, diagnostics & repairs. Genuine parts fitted with 6-month workmanship guarantee.',
    'Book a Service',
    '254755456789',
    false, true, true, NOW() + INTERVAL '7 days', 3, 'homepage_banner',
    '30 days', NOW(), NOW() + INTERVAL '30 days', NULL
  ),
  (
    'Ndeiya Poultry Farm',
    'https://picsum.photos/seed/ndeiya-poultry/1200/400',
    'Day-old chicks, layers, kienyeji & dressed chicken. Vaccinated, brooding services and free delivery over KES 5,000.',
    'Order Chicks',
    '254766567890',
    false, true, true, NOW() + INTERVAL '7 days', 4, 'homepage_banner',
    '30 days', NOW(), NOW() + INTERVAL '30 days', NULL
  ),
  (
    'Ndeiya Dairy Co-op — Partner',
    'https://picsum.photos/seed/ndeiya-dairy/1600/120',
    'Quality assured milk collected from 1,200+ member farmers, delivered to factories & eateries daily.',
    'Become a Member',
    '254701112233',
    false, true, false, NULL, 0, 'sitewide_strip',
    '30 days', NOW(), NOW() + INTERVAL '30 days', 'bronze'
  ),
  (
    'Kikuyu Farm Supplies — Partner',
    'https://picsum.photos/seed/kikuyu-farm-supply/1600/120',
    'Certified seeds, fertilisers & agrochemicals for Kikuyu & Limuru farmers. Agronomist advice on site.',
    'Visit Us',
    '254722445566',
    false, true, false, NULL, 0, 'category_strip',
    '30 days', NOW(), NOW() + INTERVAL '30 days', 'silver'
  );