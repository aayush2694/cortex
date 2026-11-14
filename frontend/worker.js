// Runs on Cloudflare in front of the built site. Requests to /api/* are forwarded to the
// backend (API_ORIGIN in wrangler.jsonc), so the browser only ever talks to one address.
// Everything else is served from the Angular build.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      return fetch(new Request(target, request));
    }
    return env.ASSETS.fetch(request);
  },
};
