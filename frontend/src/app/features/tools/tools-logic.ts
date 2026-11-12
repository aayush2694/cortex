/** Pure helpers behind the developer utilities. Everything runs in the browser. */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// ---------------------------------------------------------------- JSON

/** Pretty-print (indent > 0) or minify (indent = 0) JSON. */
export function formatJson(text: string, indent = 2): Result<string> {
  if (!text.trim()) return { ok: false, error: 'Paste some JSON' };
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(text), null, indent || undefined) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------- Regex

export interface RegexMatch {
  index: number;
  text: string;
  groups: (string | undefined)[];
  named: Record<string, string | undefined>;
}

const MAX_MATCHES = 500;

export function runRegex(pattern: string, flags: string, input: string): Result<RegexMatch[]> {
  if (!pattern) return { ok: true, value: [] };
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const out: RegexMatch[] = [];
  for (const m of input.matchAll(re)) {
    out.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1), named: { ...(m.groups ?? {}) } });
    if (out.length >= MAX_MATCHES) break;
  }
  return { ok: true, value: out };
}

/** Split text into plain and matched pieces, for highlighting. */
export function highlight(input: string, matches: RegexMatch[]): { text: string; hit: boolean }[] {
  const pieces: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const m of matches) {
    if (!m.text) continue; // empty matches have nothing to highlight
    if (m.index > at) pieces.push({ text: input.slice(at, m.index), hit: false });
    pieces.push({ text: m.text, hit: true });
    at = m.index + m.text.length;
  }
  if (at < input.length) pieces.push({ text: input.slice(at), hit: false });
  return pieces;
}

// ---------------------------------------------------------------- Base64 and URL

/** UTF-8 safe Base64 (btoa alone only handles Latin-1). */
export function toBase64(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Accepts standard and URL-safe Base64, with or without padding. */
export function fromBase64(text: string): Result<string> {
  try {
    const clean = text.trim().replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(clean + '='.repeat((4 - (clean.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: "That isn't valid Base64 text" };
  }
}

export function urlDecode(text: string): Result<string> {
  try {
    return { ok: true, value: decodeURIComponent(text.replace(/\+/g, ' ')) };
  } catch {
    return { ok: false, error: 'Malformed percent-encoding' };
  }
}

// ---------------------------------------------------------------- JWT

export interface DecodedJwt {
  header: unknown;
  payload: Record<string, unknown>;
  /** Readable times for the iat, nbf and exp claims. */
  times: { claim: string; date: string; note: string }[];
}

/** Decode (never verify) a JWT. */
export function decodeJwt(token: string, now = Date.now()): Result<DecodedJwt> {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { ok: false, error: 'A JWT has three parts separated by dots' };
  const header = fromBase64(parts[0]);
  const payload = fromBase64(parts[1]);
  if (!header.ok || !payload.ok) return { ok: false, error: "The header or payload isn't valid Base64URL" };
  try {
    const p = JSON.parse(payload.value) as Record<string, unknown>;
    const times = ['iat', 'nbf', 'exp']
      .filter((c) => typeof p[c] === 'number')
      .map((claim) => {
        const ms = (p[claim] as number) * 1000;
        let note = '';
        if (claim === 'exp') note = ms < now ? 'expired' : 'still valid';
        if (claim === 'nbf' && ms > now) note = 'not valid yet';
        return { claim, date: new Date(ms).toLocaleString(), note };
      });
    return { ok: true, value: { header: JSON.parse(header.value), payload: p, times } };
  } catch {
    return { ok: false, error: "The header or payload isn't JSON" };
  }
}

// ---------------------------------------------------------------- Timestamps

/** A Unix time in seconds or milliseconds (guessed from its size), or any date string. */
export function parseTime(text: string): Result<Date> {
  const t = text.trim();
  if (!t) return { ok: false, error: 'Enter a timestamp or a date' };
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    return { ok: true, value: new Date(Math.abs(n) < 1e11 ? n * 1000 : n) };
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? { ok: false, error: "Couldn't read that date" } : { ok: true, value: d };
}

// ---------------------------------------------------------------- Hashing

export async function sha(algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512', text: string): Promise<string> {
  const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
