export const SITE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://www.itukarua.co.ke';

export function newsletterEscapeHtml(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function newsletterPickImage(item: any): string {
  if (Array.isArray(item.images) && item.images.length > 0) return item.images[0];
  return item.image_url || item.image || `${SITE_URL}/images/logo.png`;
}

function buildBannerGrid(banners: any[]): string {
  const cells = banners.map(b => {
    const img = newsletterEscapeHtml(newsletterPickImage(b));
    const dest = b.destination_url || `${SITE_URL}/services`;
    return `
      <td style="padding:4px;width:50%;vertical-align:top">
        <a href="${dest}" style="display:block;text-decoration:none">
          <img src="${img}" alt="${newsletterEscapeHtml(b.title || 'Itukarua banner')}" width="100%" style="width:100%;border-radius:10px;display:block;border:1px solid #e5e7eb" />
          ${b.cta_text ? `<span style="display:block;text-align:center;color:#059669;font-size:12px;font-weight:600;margin-top:6px">${newsletterEscapeHtml(b.cta_text)} →</span>` : ''}
        </a>
      </td>`;
  });
  let rows = '';
  for (let i = 0; i < cells.length; i += 2) {
    const a = cells[i];
    const b = cells[i + 1] || '<td style="padding:4px;width:50%"></td>';
    rows += `<tr>${a}${b}</tr>`;
  }
  return rows;
}

export function buildNewsletterHtml(opts: {
  jobs: any[];
  ads: any[];
  banners: any[];
  dateStr: string;
  subject: string;
  intro: string;
}): string {
  const { jobs, ads, banners, dateStr, subject, intro } = opts;

  const jobCards = jobs.map(j => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top">
        <table cellpadding="0" cellspacing="0" style="width:100%">
          <tr>
            <td style="width:80px;padding-right:12px;vertical-align:top">
              <a href="${SITE_URL}/?viewJob=${j.id}" style="text-decoration:none">
                <img src="${newsletterEscapeHtml(newsletterPickImage(j))}" alt="" width="80" height="80" style="border-radius:8px;object-fit:cover;width:80px;height:80px;background:#f3f4f6" />
              </a>
            </td>
            <td style="vertical-align:top">
              <a href="${SITE_URL}/?viewJob=${j.id}" style="text-decoration:none;color:#111827;font-weight:600;font-size:15px;display:block;margin-bottom:4px">${newsletterEscapeHtml(j.title)}</a>
              <span style="color:#6b7280;font-size:12px">📍 ${newsletterEscapeHtml(j.location || '')}${j.budget_min ? ` • KES ${j.budget_min.toLocaleString()}${j.budget_max ? ` - ${j.budget_max.toLocaleString()}` : ''}` : ''}</span>
              <p style="color:#6b7280;font-size:12px;margin:6px 0 0;line-height:1.4">${newsletterEscapeHtml((j.description || '').slice(0, 120))}${(j.description || '').length > 120 ? '...' : ''}</p>
              <a href="${SITE_URL}/?viewJob=${j.id}" style="display:inline-block;margin-top:8px;padding:6px 16px;background:#059669;color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">View Job →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const adCards = ads.map(a => {
    const img = newsletterEscapeHtml(newsletterPickImage(a));
    return `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top">
        <table cellpadding="0" cellspacing="0" style="width:100%">
          <tr>
            <td style="width:80px;padding-right:12px;vertical-align:top">
              <a href="${SITE_URL}/services" style="text-decoration:none">
                <img src="${img}" alt="" width="80" height="80" style="border-radius:8px;object-fit:cover;width:80px;height:80px;background:#f3f4f6" />
              </a>
            </td>
            <td style="vertical-align:top">
              <a href="${SITE_URL}/services" style="text-decoration:none;color:#111827;font-weight:600;font-size:15px;display:block;margin-bottom:4px">${newsletterEscapeHtml(a.business_name)}</a>
              <span style="color:#6b7280;font-size:12px">${newsletterEscapeHtml(a.category || '')}${a.location ? ` • ${newsletterEscapeHtml(a.location)}` : ''}</span>
              <p style="color:#6b7280;font-size:12px;margin:6px 0 0;line-height:1.4">${newsletterEscapeHtml((a.description || '').slice(0, 120))}${(a.description || '').length > 120 ? '...' : ''}</p>
              <a href="${SITE_URL}/services" style="display:inline-block;margin-top:8px;padding:6px 16px;background:#059669;color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">View Service →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `}).join('');

  const hasContent = jobs.length > 0 || ads.length > 0 || banners.length > 0;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff">
  <tr><td style="background:linear-gradient(135deg,#059669,#047857);padding:24px">
    <table cellpadding="0" cellspacing="0" style="width:100%">
      <tr>
        <td style="width:56px;vertical-align:middle">
          <img src="${SITE_URL}/images/logo.png" alt="" width="56" height="56" style="border-radius:12px;display:block" />
        </td>
        <td style="padding-left:16px;vertical-align:middle">
          <h1 style="color:#fff;font-size:20px;margin:0 0 2px;font-weight:700">Itukarua</h1>
          <p style="color:#d1fae5;font-size:13px;margin:0">${dateStr}</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 24px 4px">
    <h2 style="font-size:18px;color:#111827;margin:0 0 4px">${newsletterEscapeHtml(subject)}</h2>
    <p style="font-size:13px;color:#6b7280;margin:0">${newsletterEscapeHtml(intro)}</p>
  </td></tr>

  ${banners.length > 0 ? `
  <tr><td style="padding:20px 24px 4px">
    <h2 style="font-size:16px;color:#111827;margin:0 0 8px">🏷️ This Month's Banners</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%">${buildBannerGrid(banners)}</table>
  </td></tr>` : ''}

  ${jobs.length > 0 ? `
  <tr><td style="padding:24px">
    <h2 style="font-size:16px;color:#111827;margin:0 0 12px">⭐ Top Job Picks</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">${jobCards}</table>
    <a href="${SITE_URL}/jobs" style="display:block;text-align:center;margin-top:12px;color:#059669;font-size:13px;font-weight:600;text-decoration:none">Browse All Jobs →</a>
  </td></tr>` : ''}

  ${ads.length > 0 ? `
  <tr><td style="padding:0 24px 24px">
    <h2 style="font-size:16px;color:#111827;margin:0 0 12px">🌟 Businesses Around You</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">${adCards}</table>
    <a href="${SITE_URL}/services" style="display:block;text-align:center;margin-top:12px;color:#059669;font-size:13px;font-weight:600;text-decoration:none">Browse All Services →</a>
  </td></tr>` : ''}

  ${!hasContent ? `
  <tr><td style="padding:48px 24px;text-align:center">
    <p style="color:#6b7280;font-size:14px;margin:0">No listings available at the moment. Check back soon!</p>
  </td></tr>` : ''}

  <tr><td style="background:#f3f4f6;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#6b7280;font-size:11px;margin:0 0 8px">
      <a href="${SITE_URL}" style="color:#059669;text-decoration:none">Itukarua Classifieds</a> —
      <a href="${SITE_URL}/jobs" style="color:#059669;text-decoration:none">Jobs</a> —
      <a href="${SITE_URL}/services" style="color:#059669;text-decoration:none">Services</a>
    </p>
    <p style="color:#9ca3af;font-size:11px;margin:0">You received this because you subscribed to Itukarua updates.</p>
    <p style="margin:4px 0 0"><a href="${SITE_URL}/api/unsubscribe?email={{email}}" style="color:#9ca3af;font-size:11px">Unsubscribe</a></p>
  </td></tr>
</table>
</body>
</html>`;
}

export function buildNewsletterText(opts: { subject: string; jobs: any[]; ads: any[]; banners: any[] }): string {
  return `Itukarua Newsletter — ${opts.subject}\n\n${opts.banners.length} banners, ${opts.jobs.length} available jobs, ${opts.ads.length} businesses around you.\n\nView online: ${SITE_URL}`;
}
