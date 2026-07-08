DELETE FROM advertisements;

INSERT INTO advertisements (title, image_url, destination_url, description, cta_text, whatsapp_number, is_affiliate, active, sort_order)
VALUES
  (
    'Quality Furniture – Shop & Save Today',
    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=1600&h=200&fit=crop&q=80',
    'https://example.com/furniture-ke',
    'Modern sofas, beds, dining sets. Free delivery Nairobi. Pay on delivery available.',
    'Browse Collection',
    '254733000222',
    true, true, 0
  ),
  (
    'Fast Internet – 100Mbps from Ksh 2,500/mo',
    'https://images.unsplash.com/photo-1563986768609-322da13575f2?w=1600&h=200&fit=crop&q=80',
    'https://example.com/internet-ke',
    'Reliable fibre internet for home & office. No hidden fees. Install within 48hrs.',
    'Check Coverage',
    '254744000333',
    true, true, 1
  ),
  (
    'Solar Panel Installation – Save 50% on Power',
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1600&h=200&fit=crop&q=80',
    'https://example.com/solar-kenya',
    'Affordable solar solutions for homes & businesses. Free site survey.',
    'Get Free Quote',
    '254722000111',
    true, true, 2
  ),
  (
    'Chloride Batteries Nairobi – Power You Can Trust',
    'https://images.unsplash.com/photo-1597404294360-7a0a1c0c9b1c?w=1600&h=200&fit=crop&q=80',
    'https://example.com/chloride-batteries',
    'Premium automotive, solar & industrial batteries. Free delivery within Nairobi.',
    'Call 0712 345 678',
    '254712345678',
    true, true, 3
  ),
  (
    'Fresh Farm Produce – Order Online',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&h=200&fit=crop&q=80',
    'https://example.com/freshfarm',
    'Farm-fresh fruits, vegetables & dairy delivered to your doorstep.',
    'Order Now',
    '254755000444',
    true, true, 4
  );
