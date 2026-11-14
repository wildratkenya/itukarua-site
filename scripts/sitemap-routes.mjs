/**
 * Canonical route list for sitemap.xml.
 *
 * The sitemap is generated at build time from this data plus VITE_SITE_URL, so
 * the host is never hardcoded and a domain change needs no edits here.
 *
 * Only routes the router actually serves belong in SITEMAP_ROUTES. The router
 * in src/App.tsx declares real URL routes for "/", "/jobs", "/jobs/:id",
 * "/services", "/services/:id", "/pricing", "/about", "/contact", "/corporate",
 * "/inbox", "/dashboard", "/advertise", "/day-pass", plus catch-all "*"
 * (NotFound). Private/auth-gated routes are intentionally excluded below.
 *
 * Paths previously advertised that now have a real router entry were moved out
 * of RETIRED_PATHS into SITEMAP_ROUTES. Paths that remain client-state-only
 * (e.g. /jobs/<county>, /jobs/<county>/<category>, /services/<county>) have no
 * matching URL route and render the 404 page, so they stay retired.
 */

export const SITEMAP_ROUTES = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/advertise', changefreq: 'weekly', priority: 0.6 },
  { path: '/jobs', changefreq: 'daily', priority: 0.8 },
  { path: '/services', changefreq: 'daily', priority: 0.8 },
  { path: '/pricing', changefreq: 'weekly', priority: 0.7 },
  { path: '/about', changefreq: 'monthly', priority: 0.5 },
  { path: '/contact', changefreq: 'monthly', priority: 0.5 },
  { path: '/corporate', changefreq: 'monthly', priority: 0.5 },
  { path: '/day-pass', changefreq: 'weekly', priority: 0.5 },
];

/**
 * Previously advertised in sitemap.xml. These have no matching URL route, so
 * Googlebot fetched them and got the NotFound page. Kept retired until a route
 * exists for them. Do not add them back to SITEMAP_ROUTES until then.
 */
export const RETIRED_PATHS = [
  '/jobs/nairobi', '/jobs/kiambu', '/jobs/mombasa', '/jobs/kisumu', '/jobs/nakuru',
  '/jobs/nyeri', '/jobs/meru', '/jobs/embu', '/jobs/machakos', '/jobs/kajiado',
  '/jobs/kisii', '/jobs/kericho', '/jobs/uasin-gishu', '/jobs/bungoma', '/jobs/kakamega',
  '/jobs/busia', '/jobs/siaya', '/jobs/homa-bay', '/jobs/migori', '/jobs/narok',
  '/jobs/nyamira', '/jobs/kilifi', '/jobs/kwale', '/jobs/taita-taveta', '/jobs/kitui',
  '/jobs/makueni', '/jobs/murang-a', '/jobs/nyandarua', '/jobs/kirinyaga', '/jobs/bomet',
  '/jobs/samburu', '/jobs/trans-nzoia', '/jobs/nandi', '/jobs/baringo', '/jobs/laikipia',
  '/jobs/elgeyo-marakwet', '/jobs/west-pokot', '/jobs/turkana', '/jobs/marsabit',
  '/jobs/isio-lo', '/jobs/mandera', '/jobs/wajir', '/jobs/garissa', '/jobs/lamu',
  '/jobs/tana-river', '/jobs/vihiga', '/jobs/tharaka-nithi',
  '/jobs/nairobi/construction', '/jobs/nairobi/plumbing', '/jobs/nairobi/electrical',
  '/jobs/nairobi/domestic-work', '/jobs/nairobi/farming', '/jobs/nairobi/transport',
  '/jobs/nairobi/carpentry', '/jobs/nairobi/painting', '/jobs/nairobi/masonry',
  '/jobs/nairobi/welding', '/jobs/kiambu/construction', '/jobs/kiambu/plumbing',
  '/jobs/kiambu/electrical', '/jobs/kiambu/farming', '/jobs/kiambu/domestic-work',
  '/jobs/mombasa/construction', '/jobs/mombasa/plumbing', '/jobs/kisumu/construction',
  '/jobs/nakuru/construction', '/jobs/nyeri/construction',
  '/services/nairobi', '/services/kiambu', '/services/mombasa', '/services/kisumu',
  '/services/nakuru', '/services/nyeri',
];

/**
 * Private and auth-gated areas. Never advertise these and never follow a
 * request that reaches them. /admin has a real route but redirects anonymous
 * visitors to "/", so indexing it would only waste crawl budget.
 */
export const ROBOTS_DISALLOW = [
  '/dashboard',
  '/admin',
  '/inbox',
  '/api/',
  '/auth/',
];
