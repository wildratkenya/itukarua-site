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
    period: '/mo • 30-day subscription',
    features: [
      'Create professional profile',
      'Bid on unlimited jobs',
      'Receive job notifications',
      'Rating & review system',
      'Direct messaging with employers',
      'Profile visibility to all employers',
    ],
  },
  jobseekerFree: {
    name: 'Free',
    price: 0,
    features: [
      'Create a professional jobseeker profile',
      '10 job bids per week in your category',
      'Basic visibility in employer searches',
      'Receive in-app job notifications',
      'View open job listings',
      'Rate & review after completed work',
    ],
  },
  jobseekerPremium: {
    name: 'Premium',
    price: 100,
    period: '/month',
    features: [
      'Unlimited job bids in your category',
      'Direct messaging with employers',
      'Priority visibility in employer searches',
      'Ratings & recommendations from employers',
      'Profile views analytics & ranking',
      'Featured badge on profile',
      'WhatsApp contact for employers',
    ],
  },
  employerSubscription: {
    name: 'Employer Access',
    price: 200,
    period: '/week',
    features: [
      'See all active jobseekers in your category',
      'Full contact details — phone, email, WhatsApp',
      'View certifications, CVs & portfolios',
      'Direct messaging with jobseekers',
      'Post unlimited jobs in your category',
      'Bid management & hiring tools',
    ],
  },
  singleJobPost: {
    name: 'Single Job Access',
    price: 100,
    period: '/1 day',
    features: [
      'Unlock contacts for ONE job for 24 hours',
      'See all bids on that job',
      'Unlock bidder contacts — phone, email, WhatsApp',
      'No weekly subscription commitment',
    ],
  },
  subscriptionPackages: [
    { id: 'monthly', name: 'Monthly', price: 100, days: 30, description: '30 days access', popular: true },
    { id: 'weekly', name: 'Weekly', price: 200, days: 7, description: '7 days employer access', popular: true },
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
  featuredBoost: {
    name: 'Featured Boost',
    price: 500,
    period: 'per week',
    description: 'Boost your advert to the top of search results and homepage carousel.',
  },
};

// Corporate placements (Phase 1 pricing — quoted via /advertise, no price listed on page).
export const CORPORATE_PACKAGES = [
  {
    id: 'bronze',
    tier: 'Bronze',
    slot: 'sitewide_strip',
    headline: 'Branded site-wide strip',
    features: [
      'Slim branded strip shown on every page — homepage, jobs, services & listings',
      'Your business name + tagline to every visitor, with WhatsApp / website CTA',
      'Account invoicing and dedicated support for your placement',
      'Ideal for co-ops, churches, schools & foundations',
    ],
  },
  {
    id: 'silver',
    tier: 'Silver',
    slot: 'category_strip',
    headline: 'Homepage + Jobs strips',
    features: [
      'Branded strip on the homepage AND the Jobs & Services pages',
      '2 concurrent ad placements across your strips',
      '2 team seats for your marketing team',
      'Perfect for recruiters, trainers & sector suppliers',
    ],
  },
  {
    id: 'gold',
    tier: 'Gold',
    slot: 'homepage_banner',
    headline: 'Every placement, boosted',
    features: [
      'All three prime slots: homepage carousel + site-wide + Jobs/Services strips',
      'Featured boost & priority delivery for the entire term',
      'Full analytics dashboard with clicks and daily detail',
      'Up to 5 images per creative with full-size popup',
      '4 concurrent placements & 5 team seats',
    ],
  },
  {
    id: 'custom',
    tier: 'Custom',
    slot: 'custom',
    headline: 'Made for your goals',
    features: [
      'County-wide or multi-location placement scope',
      'Event-timed campaigns, including newsletter push',
      'Any combination of slots plus extra placements & seats',
      'Scoped and quoted per brief — partnership pricing available',
    ],
  },
];

export const CORPORATE_TIER_FEATURES: Record<string, {
  slots: string[];
  maxPlacements: number;
  analyticsDepth: 'basic' | 'full';
  teamSeats: number;
  featured: boolean;
  multiImages: boolean;
}> = {
  bronze: {
    slots: ['sitewide_strip'],
    maxPlacements: 1,
    analyticsDepth: 'basic',
    teamSeats: 1,
    featured: false,
    multiImages: false,
  },
  silver: {
    slots: ['sitewide_strip', 'category_strip'],
    maxPlacements: 2,
    analyticsDepth: 'basic',
    teamSeats: 2,
    featured: false,
    multiImages: false,
  },
  gold: {
    slots: ['sitewide_strip', 'category_strip', 'homepage_banner'],
    maxPlacements: 4,
    analyticsDepth: 'full',
    teamSeats: 5,
    featured: true,
    multiImages: true,
  },
  custom: {
    slots: ['sitewide_strip', 'category_strip', 'homepage_banner', 'job_listings_top'],
    maxPlacements: 99,
    analyticsDepth: 'full',
    teamSeats: 20,
    featured: true,
    multiImages: true,
  },
};

// ─── Corporate Features Catalog ─────────────────────────────────────────────
// The single list of every corporate feature. Fixed tiers (bronze/silver/gold)
// map onto it via TIER_FEATURE_IDS; the Custom tier is any subset ticked by the
// admin. The aggregate estimate prices a custom bundle so it can be rated.

export type CorporateFeatureGroup = 'Placements' | 'Capabilities' | 'Team';

export interface CorporateFeature {
  id: string;
  label: string;
  group: CorporateFeatureGroup;
  /** KES per month (flat inclusion, or per unit for perUnit features). */
  monthly: number;
  /** Quantity features (placements / team seats) are counted per unit over the base of 1. */
  perUnit?: boolean;
  description?: string;
}

export const FEATURE_GROUPS: CorporateFeatureGroup[] = ['Placements', 'Capabilities', 'Team'];

const SLOT_LABELS_LOOKUP: Record<string, string> = {
  sitewide_strip: 'Site-wide strip',
  category_strip: 'Jobs & Services strip',
  homepage_banner: 'Homepage carousel',
  job_listings_top: 'Corporate Top Banner',
};

export const SLOT_FEATURE_IDS = ['slot_sitewide_strip', 'slot_category_strip', 'slot_homepage_banner', 'slot_job_listings_top'] as const;

export function featureIdForSlot(slot: string): string {
  return `slot_${slot}`;
}

export function slotForFeatureId(featureId: string): string | null {
  if (!featureId.startsWith('slot_')) return null;
  const slot = featureId.slice('slot_'.length);
  return SLOT_LABELS_LOOKUP[slot] ? slot : null;
}

export function slotLabel(slot: string): string {
  return SLOT_LABELS_LOOKUP[slot] || slot;
}

export const FEATURE_CATALOG: CorporateFeature[] = [
  { id: 'slot_sitewide_strip', label: 'Site-wide strip', group: 'Placements', monthly: 3000, description: 'Slim branded strip under the header on every page' },
  { id: 'slot_category_strip', label: 'Jobs & Services strip', group: 'Placements', monthly: 3000, description: 'Branded strip across Jobs and Services pages' },
  { id: 'slot_homepage_banner', label: 'Homepage carousel', group: 'Placements', monthly: 4000, description: 'Rotating banner carousel on the homepage, directly below the hero section' },
  { id: 'slot_job_listings_top', label: 'Corporate Top Banner', group: 'Placements', monthly: 2000, description: 'Full-width banner atop every Jobs & Services listing page' },
  { id: 'featured', label: 'Featured + priority delivery', group: 'Capabilities', monthly: 2000, description: 'Featured boost for the entire term' },
  { id: 'full_analytics', label: 'Full analytics dashboard', group: 'Capabilities', monthly: 1500, description: 'Clicks & daily detail breakouts in analytics' },
  { id: 'multi_images', label: 'Multi-image creatives', group: 'Capabilities', monthly: 1000, description: 'Up to 5 images per advert' },
  { id: 'placements', label: 'Concurrent placements', group: 'Capabilities', monthly: 1000, perUnit: true, description: 'Number of live adverts you can run at once' },
  { id: 'team_seats', label: 'Team seats', group: 'Team', monthly: 500, perUnit: true, description: 'Members allowed on the corporate account' },
];

export const FEATURE_MAP: Record<string, CorporateFeature> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.id, f])
);

// Discrete (non-quantity) feature ids included by each fixed tier.
export const TIER_FEATURE_IDS: Record<string, string[]> = {
  bronze: ['slot_sitewide_strip'],
  silver: ['slot_sitewide_strip', 'slot_category_strip'],
  gold: ['slot_sitewide_strip', 'slot_category_strip', 'slot_homepage_banner', 'featured', 'full_analytics', 'multi_images'],
  custom: [],
};

export interface SavedCorporateFeatures {
  ids: string[];
  placements?: number;
  team_seats?: number;
}

export interface EffectiveCorporateFeatures {
  slots: string[];
  maxPlacements: number;
  analyticsDepth: 'basic' | 'full';
  teamSeats: number;
  featured: boolean;
  multiImages: boolean;
}

export function effectiveFeaturesFor(account: { tier: string; features?: SavedCorporateFeatures | null }): EffectiveCorporateFeatures {
  const saved = account?.features;
  if (account?.tier === 'custom' && saved && Array.isArray(saved.ids)) {
    const has = (id: string) => saved.ids.includes(id);
    const slots = SLOT_FEATURE_IDS.filter((sid) => has(sid)).map((sid) => sid.slice('slot_'.length));
    return {
      slots,
      maxPlacements: Math.max(1, saved.placements && saved.placements > 0 ? saved.placements : Math.min(1, slots.length) || 1),
      analyticsDepth: has('full_analytics') ? 'full' : 'basic',
      teamSeats: Math.max(1, saved.team_seats && saved.team_seats > 0 ? saved.team_seats : 1),
      featured: has('featured'),
      multiImages: has('multi_images'),
    };
  }
  return CORPORATE_TIER_FEATURES[account?.tier] || CORPORATE_TIER_FEATURES.bronze;
}

// Per-feature estimate for a custom bundle. The bundle is rated off the highest
// standard tier whose slots it fully covers (its anchor price), then add-on
// increments are charged only for features beyond that tier's slate and for
// placements/seats beyond that tier's baseline. So a custom bundle equal to Gold
// rates at Gold's anchor, and extras push it upward honestly.
export const CORPORATE_TIER_ANCHOR_KES: Record<string, number> = {
  bronze: 3000,
  silver: 6000,
  gold: 10000,
};

export function estimateCustomBundle(ids: string[], placements: number = 1, teamSeats: number = 1): { monthly: number; equivalence: string } {
  const has = (id: string) => ids.includes(id);
  const covers = (tier: string) => (TIER_FEATURE_IDS[tier] || []).every(has);
  let base: string | null = null;
  if (covers('gold')) base = 'gold';
  else if (covers('silver')) base = 'silver';
  else if (covers('bronze')) base = 'bronze';
  const baseDef = base ? CORPORATE_TIER_FEATURES[base] : null;

  let monthly = base ? (CORPORATE_TIER_ANCHOR_KES[base] || 0) : 0;
  const baseIds = base ? TIER_FEATURE_IDS[base] : [];
  for (const id of ids) {
    if (baseIds.includes(id)) continue;
    const f = FEATURE_MAP[id];
    if (f && !f.perUnit) monthly += f.monthly;
  }
  monthly += Math.max(0, placements - (baseDef ? baseDef.maxPlacements : 1)) * (FEATURE_MAP.placements?.monthly || 1000);
  monthly += Math.max(0, teamSeats - (baseDef ? baseDef.teamSeats : 1)) * (FEATURE_MAP.team_seats?.monthly || 500);

  let equivalence: string;
  if (!base) {
    equivalence = 'Custom';
  } else {
    const extras = ids.filter(id => !baseIds.includes(id) && !(FEATURE_MAP[id]?.perUnit));
    const aboveQuantities = placements > (baseDef?.maxPlacements ?? 0) || teamSeats > (baseDef?.teamSeats ?? 0);
    if (extras.length === 0 && !aboveQuantities) {
      equivalence = base === 'gold' ? 'Gold-equivalent' : base === 'silver' ? 'Silver-equivalent' : 'Bronze-based';
    } else {
      const label = base === 'gold' ? 'Gold' : base === 'silver' ? 'Silver' : 'Bronze';
      equivalence = `${label} + add-ons`;
    }
  }
  return { monthly, equivalence };
}

