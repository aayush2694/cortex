import { JobApplication, Stage } from '../../core/api/models';

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Closed' },
];

export const SOURCES = ['LinkedIn', 'Naukri', 'Referral', 'Company site', 'Recruiter', 'Other'];

type Pay = Pick<JobApplication, 'fixed' | 'variable' | 'joining_bonus' | 'stock_per_year'>;

/** Pay you get every year: fixed + variable + stock (lakhs per annum). */
export function recurring(o: Pay): number {
  return (o.fixed ?? 0) + (o.variable ?? 0) + (o.stock_per_year ?? 0);
}

/** First-year total: recurring pay plus the one-time joining bonus. */
export function firstYear(o: Pay): number {
  return recurring(o) + (o.joining_bonus ?? 0);
}

/** Percentage change from your current CTC, or null when there's nothing to compare. */
export function hike(amount: number, current: number | null | undefined): number | null {
  if (!current || current <= 0 || !amount) return null;
  return Math.round(((amount - current) / current) * 100);
}

/** "₹16.5 L" style label; "—" when empty. */
export function lpa(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `₹${Number(n.toFixed(2))} L`;
}

/** Whole days between an ISO date (YYYY-MM-DD) and today; positive means in the past. */
export function daysSince(iso: string, today = new Date()): number {
  const then = new Date(`${iso}T00:00:00`);
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

/** "today", "tomorrow", "in 3 days", "2 days ago", or a date for anything further away. */
export function relativeDay(iso: string, today = new Date()): string {
  const d = -daysSince(iso, today);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 1 && d <= 6) return `in ${d} days`;
  if (d < -1 && d >= -6) return `${-d} days ago`;
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Stages that mean you've applied. */
export const APPLIED_STAGES: Stage[] = ['applied', 'interview', 'offer', 'rejected'];

/** Today's date (YYYY-MM-DD) in your own time zone, for "applied on". */
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}
