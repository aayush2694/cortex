// Runs on Cloudflare in front of the built site. Requests to /api/* are forwarded to the
// backend (API_ORIGIN in wrangler.jsonc), so the browser only ever talks to one address.
// Everything else is served from the Angular build.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      const forwarded = new Request(target, request);
      // Tell the API who the visitor is. CF-Connecting-IP is set by Cloudflare, so it replaces
      // anything the browser sent. Without it, send no address at all.
      const ip = request.headers.get('CF-Connecting-IP');
      if (ip) {
        forwarded.headers.set('X-Client-IP', ip);
      } else {
        forwarded.headers.delete('X-Client-IP');
      }
      // The API trusts X-Client-IP only with this secret (PROXY_SHARED_SECRET, recommended).
      // Never pass on a value the browser sent.
      forwarded.headers.delete('X-Proxy-Secret');
      if (env.PROXY_SHARED_SECRET) {
        forwarded.headers.set('X-Proxy-Secret', env.PROXY_SHARED_SECRET);
      }
      // Hand any redirect back to the browser instead of following it here, so the secret
      // header is never sent to another host.
      return fetch(forwarded, { redirect: 'manual' });
    }
    return env.ASSETS.fetch(request);
  },

  // Runs every 10 minutes (the cron in wrangler.jsonc). The free backend host sleeps after
  // 15 idle minutes and takes about a minute to wake; this request keeps it awake.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(fetch(new URL('/health', env.API_ORIGIN)));
  },
};
