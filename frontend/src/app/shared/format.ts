/** "10m", "1d", "3d", "2.1mo", "1.4y": how long until a card comes back. */
export function formatInterval(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(1).replace(/\.0$/, '')}mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`;
}

/** A Date as YYYY-MM-DD in the browser's own time zone. */
export function localDay(d: Date): string {
  return d.toLocaleDateString('en-CA');
}
