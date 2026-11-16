// Checks the Cloudflare Worker (worker.js) forwards the visitor's address to the API safely.
// @ts-expect-error worker.js is plain JavaScript with no type declarations.
import worker from '../worker.js';

describe('Cloudflare Worker /api forwarding', () => {
  let forwarded: Request[];
  let inits: (RequestInit | undefined)[];

  beforeEach(() => {
    forwarded = [];
    inits = [];
    vi.stubGlobal('fetch', async (req: Request, init?: RequestInit) => {
      forwarded.push(req);
      inits.push(init);
      return new Response('ok');
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const visit = (env: Record<string, unknown>) =>
    worker.fetch(
      new Request('https://site.test/api/v1/me?x=1', {
        headers: {
          'CF-Connecting-IP': '203.0.113.7',
          'X-Client-IP': '6.6.6.6',
          'X-Proxy-Secret': 'guessed',
        },
      }),
      { API_ORIGIN: 'https://api.test', ...env },
    );

  it('sends the Cloudflare-seen address and the shared secret, replacing client values', async () => {
    await visit({ PROXY_SHARED_SECRET: 'test-secret' });
    const [req] = forwarded;
    expect(req.url).toBe('https://api.test/api/v1/me?x=1');
    expect(req.headers.get('X-Client-IP')).toBe('203.0.113.7');
    expect(req.headers.get('X-Proxy-Secret')).toBe('test-secret');
  });

  it('removes a client-sent X-Client-IP when Cloudflare gives no address', async () => {
    await worker.fetch(
      new Request('https://site.test/api/v1/me', { headers: { 'X-Client-IP': '6.6.6.6' } }),
      { API_ORIGIN: 'https://api.test', PROXY_SHARED_SECRET: 'test-secret' },
    );
    const [req] = forwarded;
    expect(req.headers.has('X-Client-IP')).toBe(false);
  });

  it('never follows a redirect, so the secret cannot reach another host', async () => {
    await visit({ PROXY_SHARED_SECRET: 'test-secret' });
    expect(inits[0]?.redirect).toBe('manual');
  });

  it('strips a client-sent secret when the Worker has none', async () => {
    await visit({});
    const [req] = forwarded;
    expect(req.headers.get('X-Client-IP')).toBe('203.0.113.7');
    expect(req.headers.has('X-Proxy-Secret')).toBe(false);
  });
});
