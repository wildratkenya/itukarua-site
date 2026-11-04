const SITE_URL = (process.env.VITE_SITE_URL || 'https://itukarua3.vercel.app').replace(/\/+$/, '');
const ROUTES = [
  { path: '/', changefreq: 'daily', priority: 1 },
  { path: '/advertise', changefreq: 'weekly', priority: 0.6 },
  { path: '/day-pass', changefreq: 'weekly', priority: 0.5 },
];

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

interface SitemapResponse {
  setHeader(name: string, value: string): SitemapResponse;
  status(code: number): SitemapResponse;
  send(body: string): void;
}

export default function sitemap(_request: unknown, response: SitemapResponse) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const entries = ROUTES.map(route => [
    '  <url>',
    `    <loc>${escapeXml(`${SITE_URL}${route.path}`)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${route.changefreq}</changefreq>`,
    `    <priority>${route.priority.toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n')).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  response
    .setHeader('Content-Type', 'application/xml; charset=utf-8')
    .setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600')
    .status(200)
    .send(body);
}
