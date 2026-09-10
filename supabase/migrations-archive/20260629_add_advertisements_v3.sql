ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS whatsapp_number text;

INSERT INTO advertisements (title, image_url, destination_url, description, cta_text, whatsapp_number, is_affiliate, active, sort_order)
SELECT * FROM (VALUES
  ('Shop the Best Deals Online', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80', 'https://example.com/shop', 'Amazing discounts on top brands — shop now and save big', 'Shop Now', '254712345678', true, true, 0),
  ('Fashion & Accessories', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80', 'https://example.com/fashion', 'Latest fashion trends delivered to your door', 'Browse', '254723456789', true, true, 1),
  ('Electronics Mega Sale', 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80', 'https://example.com/electronics', 'Up to 50% off on electronics and gadgets', 'View Deals', '254734567890', true, true, 2),
  ('Home & Living Collection', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80', 'https://example.com/home', 'Everything you need for your home in one place', 'Explore', '254745678901', true, true, 3),
  ('Fresh Grocery Delivery', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80', 'https://example.com/groceries', 'Fresh groceries delivered to your doorstep in 2 hours', 'Order Now', '254756789012', true, true, 4)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM advertisements WHERE is_affiliate = true LIMIT 1);
