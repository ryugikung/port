// api/yahoo-proxy.js  — Vercel serverless function
// Place this file at:  <your-repo>/api/yahoo-proxy.js
//
// This runs server-side on Vercel so it bypasses CORS restrictions that block
// direct browser → Yahoo Finance requests from Vercel's production IPs.

export default async function handler(req, res) {
  // Security: only allow Yahoo Finance URLs
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  let decoded;
  try { decoded = decodeURIComponent(url); } catch {
    return res.status(400).json({ error: 'Invalid url encoding' });
  }

  if (!decoded.startsWith('https://query1.finance.yahoo.com/') &&
      !decoded.startsWith('https://query2.finance.yahoo.com/')) {
    return res.status(403).json({ error: 'Only Yahoo Finance URLs are allowed' });
  }

  try {
    const response = await fetch(decoded, {
      headers: {
        // Mimic a real browser to avoid Yahoo's bot detection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo returned ${response.status}` });
    }

    const data = await response.json();

    // Cache for 60 seconds on Vercel edge (avoids hammering Yahoo on every request)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (err) {
    console.error('[yahoo-proxy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
