// Same-origin certificate proxy. Streams PDF bytes from Supabase Storage
// server-side so the browser never sees the supabase.co storage URL.
// Route: /api/<path-under-adverts-bucket> (rewritten by vercel.json to ?p=).
const SUPABASE_URL = 'https://xahaxtbudiubelemewna.supabase.co';
const BUCKET = 'adverts';

module.exports = async function handler(req, res) {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.searchParams.get('p') || '';
  if (!p || !/^[A-Za-z0-9._/-]+$/.test(p)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('bad path');
  }
  const upstream = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`;
  let r;
  try {
    r = await fetch(upstream);
  } catch {
    r = null;
  }
  if (!r || !r.ok) {
    res.statusCode = r ? r.status : 502;
    res.setHeader('Content-Type', 'text/plain');
    return res.end(r ? 'not found' : 'upstream error');
  }
  res.setHeader('Content-Type', r.headers.get('content-type') || 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  const buf = Buffer.from(await r.arrayBuffer());
  res.end(buf);
};