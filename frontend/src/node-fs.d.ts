// Minimal typing so csp.spec.ts can read index.html without pulling in all of @types/node.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
