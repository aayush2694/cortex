// Reads src/index.html from disk (tests run from frontend/) and checks the Content-Security-Policy.
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync('src/index.html', 'utf8');
const workerJs = readFileSync('public/pyodide-worker.js', 'utf8');
// The worker's Pyodide URL; the policy allows this path of the CDN and nothing else.
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/';

describe('index.html Content-Security-Policy', () => {
  const doc = new DOMParser().parseFromString(indexHtml, 'text/html');
  const policy = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '';

  const directive = (name: string) =>
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .find(([n]) => n === name)
      ?.slice(1);

  it('declares a policy', () => {
    expect(policy).not.toBe('');
  });

  it('blocks plugins and eval, and limits scripts to self plus the Pyodide CDN', () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(directive('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", PYODIDE]);
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  // jsDelivr serves any npm package or GitHub file, so only its Pyodide path is allowed.
  it('limits the CDN to its Pyodide path for scripts and connections', () => {
    expect(directive('connect-src')).toEqual(["'self'", PYODIDE]);
    expect(policy).not.toMatch(/https:\/\/cdn\.jsdelivr\.net(?!\/pyodide\/)/);
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

  it('allows the URL the Pyodide worker actually loads', () => {
    expect(workerJs).toContain(`const PYODIDE_URL = \`${PYODIDE}v\${PYODIDE_VERSION}/full/\`;`);
  });
});
