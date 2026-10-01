/**
 * Canonical route list for sitemap.xml.
 *
 * The sitemap is generated at build time from this data plus VITE_SITE_URL, so
 * the host is never hardcoded and a domain change needs no edits here.
 *
 * Only routes the router actually serves belong in ROUTES. The app is a
 * client-state SPA: pages like /jobs, /services and /pricing are rendered by
 * <AppLayout> from React state, not from a URL. The router in src/App.tsx
 * declares only "/", "/advertise", "/admin" and a catch-all "*" -> NotFound,
 * and nothing in the codebase calls pushState. Any path outside ROUTES
 * therefore renders the 404 page.
 *
 * Paths the sitemap previously advertised that have no matching route are kept
 * in RETIRED_PATHS below rather than deleted, so they can be restored if the
 * app later grows real URL routes. Do not add them back to the sitemap until a
 * route exists for them.
 */

export const SITEMAP_ROUTES = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/advertise', changefreq: 'weekly', priority: 0.6 },
];

/**
 * Previously advertised in sitemap.xml. None of these have a router entry, so
 * Googlebot fetched them and got the NotFound page.
 *
 * /jobs            /services        /pricing         /about
 * /contact         /jobs/<county>   (47 counties)
 * /jobs/<county>/<category>         (20 county+category pairs)
 * /services/<county>                (6 counties)
 */
export const RETIRED_PATHS = [
  '/jobs', '/services', '/pricing', '/about', '/contact',
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
