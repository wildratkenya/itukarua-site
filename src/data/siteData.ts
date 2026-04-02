// Image URLs
export const IMAGES = {
  hero: 'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055506194_45521c8f.jpg',
  workers: [
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055519790_6d9a2247.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055526394_2dbf1477.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055527201_c17a0637.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055526643_328e0d23.jpg',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055530416_2dc0bdd8.png',
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055530036_9defd78c.png',
  ],
  services: [
    'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055543861_b8e656f2.jpg',
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
  'Itukarua Town',
  'Karatina',
  'Nyeri',
  'Sagana',
  'Mwea',
  'Kerugoya',
  'Kutus',
  'Embu',
  'Murang\'a',
  'Thika',
  'Nanyuki',
  'Meru',
];

export const PRICING_PLANS = {
  jobseeker: {
    name: 'Jobseeker Registration',
    price: 500,
    period: 'one-time',
    features: [
      'Create professional profile',
      'Bid on unlimited jobs',
      'Receive job notifications',
      'Rating & review system',
      'Direct messaging with employers',
      'Profile visibility to all employers',
    ],
  },
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
  employerAccess: {
    name: 'Contact Access Fee',
    price: 200,
    period: 'per contact',
    description: 'Pay to unlock jobseeker contact details after selecting the best bidder.',
  },
  featuredBoost: {
    name: 'Featured Boost',
    price: 500,
    period: 'per week',
    description: 'Boost your advert to the top of search results and homepage carousel.',
  },
};
