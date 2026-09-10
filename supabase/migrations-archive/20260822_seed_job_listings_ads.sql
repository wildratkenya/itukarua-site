-- Seed 2 example ads for the Job Listings Top Banner slot
-- Run this AFTER running the slot migration (20260822_add_ad_slot.sql)
-- These are sample ads so you can see the banner working on /jobs

INSERT INTO advertisements (title, image_url, destination_url, description, cta_text, whatsapp_number, is_affiliate, active, sort_order, slot, billing_cycle, billing_start, billing_end)
VALUES
  (
    'Hire Skilled Construction Workers Today',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=200&fit=crop&q=80',
    'https://example.com/construction-hire',
    'Licensed & vetted builders, masons, plumbers. Available across all counties. Call now for a free quote.',
    'Get a Quote',
    '254712345678',
    false, true, 0, 'job_listings_top',
    '7 days',
    NOW(),
    NOW() + INTERVAL '7 days'
  ),
  (
    'PPE Kenya – Safety Gear for Every Job Site',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=200&fit=crop&q=80',
    'https://example.com/ppe-kenya',
    'Hard hats, boots, gloves, reflective vests. Bulk orders welcome. Nairobi same-day delivery.',
    'Shop Now',
    '254798765432',
    false, true, 1, 'job_listings_top',
    '7 days',
    NOW(),
    NOW() + INTERVAL '7 days'
  );
