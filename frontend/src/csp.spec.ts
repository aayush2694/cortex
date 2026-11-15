// Reads src/index.html from disk (tests run from frontend/) and checks the Content-Security-Policy.
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync('src/index.html', 'utf8');

describe('index.html Content-Security-Policy', () => {
  const doc = new DOMParser().parseFromString(indexHtml, 'text/html');
  const policy = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '';

  it('declares a policy', () => {
    expect(policy).not.toBe('');
  });

  it('blocks plugins and eval, and limits scripts to self plus the Pyodide CDN', () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('has no inline scripts', () => {
    const inline = Array.from(doc.querySelectorAll('script')).filter((s) => !s.hasAttribute('src'));
    expect(inline.length).toBe(0);
  });

  it('loads the theme script from a file, synchronously', () => {
    const s = doc.querySelector('script[src="theme-init.js"]');
    expect(s).not.toBeNull();
    expect(s?.hasAttribute('defer')).toBe(false);
    expect(s?.hasAttribute('async')).toBe(false);
  });
});
