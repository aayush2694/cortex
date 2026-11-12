import {
  decodeJwt,
  formatJson,
  fromBase64,
  highlight,
  parseTime,
  runRegex,
  sha,
  toBase64,
  urlDecode,
} from './tools-logic';

describe('formatJson', () => {
  it('pretty prints and minifies', () => {
    expect(formatJson('{"a":[1,2]}')).toEqual({ ok: true, value: '{\n  "a": [\n    1,\n    2\n  ]\n}' });
    expect(formatJson('{ "a" : 1 }', 0)).toEqual({ ok: true, value: '{"a":1}' });
  });

  it('explains errors', () => {
    const r = formatJson('{"a": 1,}');
    expect(r.ok).toBe(false);
  });
});

describe('runRegex and highlight', () => {
  it('finds every match with groups', () => {
    const r = runRegex('(?<user>\\w+)@(\\w+)\\.com', 'i', 'a@x.com, b@y.com');
    expect(r.ok && r.value.map((m) => m.text)).toEqual(['a@x.com', 'b@y.com']);
    expect(r.ok && r.value[0].named['user']).toBe('a');
  });

  it('reports bad patterns', () => {
    expect(runRegex('(', '', 'x').ok).toBe(false);
  });

  it('splits text for highlighting', () => {
    const r = runRegex('\\d+', '', 'a1b22');
    expect(r.ok && highlight('a1b22', r.value)).toEqual([
      { text: 'a', hit: false },
      { text: '1', hit: true },
      { text: 'b', hit: false },
      { text: '22', hit: true },
    ]);
  });
});

describe('Base64, URL and hashing', () => {
  it('round-trips Unicode through Base64', () => {
    expect(toBase64('नमस्ते ✓')).toBeTruthy();
    expect(fromBase64(toBase64('नमस्ते ✓'))).toEqual({ ok: true, value: 'नमस्ते ✓' });
    expect(fromBase64('***').ok).toBe(false);
  });

  it('decodes URLs', () => {
    expect(urlDecode('a%20b+c')).toEqual({ ok: true, value: 'a b c' });
    expect(urlDecode('%E0%A4%A').ok).toBe(false);
  });

  it('hashes with SHA-256', async () => {
    expect(await sha('SHA-256', 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('decodeJwt', () => {
  const b64url = (o: object) => toBase64(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '42', exp: 1000 })}.sig`;

  it('decodes header, payload and times', () => {
    const r = decodeJwt(token, 2_000_000);
    expect(r.ok && r.value.payload['sub']).toBe('42');
    expect(r.ok && r.value.times[0].note).toBe('expired');
  });

  it('rejects things that are not JWTs', () => {
    expect(decodeJwt('abc').ok).toBe(false);
  });
});

describe('parseTime', () => {
  it('guesses seconds versus milliseconds', () => {
    const s = parseTime('1700000000');
    const ms = parseTime('1700000000000');
    expect(s.ok && ms.ok && s.value.getTime() === ms.value.getTime()).toBe(true);
    expect(parseTime('2026-11-13T10:00:00Z').ok).toBe(true);
    expect(parseTime('nope').ok).toBe(false);
  });
});
