// Surfline API Proxy - Cloudflare Worker
// Proxies requests to Surfline's API, bypassing Cloudflare bot protection
// since requests originate from within Cloudflare's network.

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/' || path === '/health') {
      return jsonResponse({ status: 'ok', service: 'surfline-proxy' });
    }

    // Proxy endpoint: /proxy?url=<encoded surfline URL>
    if (path === '/proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl || !targetUrl.includes('services.surfline.com')) {
        return jsonResponse({ error: 'Invalid URL. Only services.surfline.com allowed.' }, 400);
      }

      try {
        const resp = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.surfline.com/',
            'Origin': 'https://www.surfline.com',
          }
        });

        const data = await resp.text();

        return new Response(data, {
          status: resp.status,
          headers: {
            'Content-Type': resp.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
            'Cache-Control': 'public, max-age=300', // cache 5 min at edge
          }
        });
      } catch (e) {
        return jsonResponse({ error: 'Proxy fetch failed', message: e.message }, 502);
      }
    }

    // Batch endpoint: /batch - fetch multiple URLs at once
    if (path === '/batch' && request.method === 'POST') {
      try {
        const body = await request.json();
        const urls = body.urls || [];
        if (urls.length === 0 || urls.length > 20) {
          return jsonResponse({ error: 'Provide 1-20 URLs' }, 400);
        }

        const results = await Promise.all(urls.map(async (targetUrl) => {
          if (!targetUrl.includes('services.surfline.com')) {
            return { url: targetUrl, error: 'Invalid URL' };
          }
          try {
            const resp = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.surfline.com/',
                'Origin': 'https://www.surfline.com',
              }
            });
            const data = await resp.json();
            return { url: targetUrl, status: resp.status, data };
          } catch (e) {
            return { url: targetUrl, error: e.message };
          }
        }));

        return new Response(JSON.stringify({ results }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
            'Cache-Control': 'public, max-age=300',
          }
        });
      } catch (e) {
        return jsonResponse({ error: 'Bad request', message: e.message }, 400);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
