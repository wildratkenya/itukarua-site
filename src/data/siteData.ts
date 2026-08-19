// Image URLs
export const IMAGES = {
  hero: '/images/hero.jpg',
  workers: [
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055519790_6d9a2247.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055526394_2dbf1477.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055527201_c17a0637.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055526643_328e0d23.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055530416_2dc0bdd8.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055530036_9defd78c.png',
  ],
  services: [
    '/images/services-fallback.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055546340_aa068d91.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055546937_9e0b2de7.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055547177_6b7ccd97.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055553350_fb8b67eb.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055549701_9c9652a7.jpg',
  ],
  community: [
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055577607_31e0cbc1.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055571369_7f52ff64.jpg',
  ],
};

export const JOB_CATEGORIES = [
  'All Categories',
  'Construction',
  'Painting',
  'Plumbing',
  'Electrical',
  'Domestic Work',
  'Farming',
  'Fencing',
  'Landscaping',
  'Transport',
  'Carpentry',
  'Masonry',
  'Welding',
];

export const SERVICE_CATEGORIES = [
  'All Services',
  'Shops',
  'Plumbing',
  'Electrical',
  'Salon & Beauty',
  'Tutoring',
  'Mechanics',
  'Catering',
  'Photography',
  'IT Services',
  'Cleaning',
  'Security',
];

export const LOCATIONS = [
  'All Locations',
  'Kikuyu',
  'Kiambu',
  'Limuru',
  'Karatina',
  'Nyeri',
  'Sagana',
  'Mwea',
  'Kerugoya',
  'Kutus',
  'Embu',
  "Murang'a",
  'Thika',
  'Nanyuki',
  'Meru',
];

export const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia',
  'Elgeyo-Marakwet', 'Embu',
  'Garissa',
  'Homa Bay',
  'Isiolo',
  'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale',
  'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a",
  'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya',
  'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana',
  'Uasin Gishu',
  'Vihiga',
  'Wajir', 'West Pokot',
];

export const PRICING_PLANS = {
  jobseeker: {
    name: 'Jobseeker Registration',
    price: 100,
    period: '/wk • 7-day subscription',
    features: [
      'Create professional profile',
      'Bid on unlimited jobs',
      'Receive job notifications',
      'Rating & review system',
      'Direct messaging with employers',
      'Profile visibility to all employers',
    ],
  },
  subscriptionPackages: [
    { id: 'weekly', name: 'Weekly', price: 100, days: 7, description: '7 days access', popular: true },
    { id: 'monthly', name: 'Monthly', price: 400, days: 30, description: '30 days access (save 14%)' },
  ],
  advertPlans: [
    {
      name: '10-Day Advert',
      price: 300,
      duration: '10 days',
      popular: false,
      features: [
        'Business listing for 10 days',
        'Up to 3 images',
        'Contact details visible',
        'Category listing',
        'Basic analytics',
      ],
    },
    {
      name: '20-Day Advert',
      price: 500,
      duration: '20 days',
      popular: true,
      features: [
        'Business listing for 20 days',
        'Up to 5 images',
        'Contact details visible',
        'Category listing',
        'Priority placement',
        'Detailed analytics',
      ],
    },
    {
      name: '30-Day Advert',
      price: 800,
      duration: '30 days',
      popular: false,
      features: [
        'Business listing for 30 days',
        'Up to 8 images',
        'Contact details visible',
        'Featured on homepage',
        'Top category placement',
        'Full analytics dashboard',
        'Social media promotion',
      ],
    },
  ],
  homepageAdvert: {
    name: 'Homepage Advert',
    price: 100,
    period: 'per week',
    features: [
      'Prime banner placement at the very top of the homepage',
      'Your advert photo shown to every homepage visitor, 24/7',
      'Up to 5 images — a full-size popup opens when clicked',
      'Catchy advert title & description',
      '"Chat on WhatsApp" button so customers contact you instantly',
      'Optional button linking to your website or listing',
      'Advert displays in the rotating carousel with other ads',
      'Clicks & views tracked in your analytics',
      'Live for 7 full days (KES 100 per week)',
    ],
  },
  employerAccess: {
    name: 'Contact Access Fee',
    price: 50,
    period: 'per contact',
    description: 'Pay KES 50 to unlock jobseeker contact details, certifications and CV.',
  },
  featuredBoost: {
    name: 'Featured Boost',
    price: 500,
    period: 'per week',
    description: 'Boost your advert to the top of search results and homepage carousel.',
  },
};

