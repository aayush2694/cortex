import { execFileSync } from 'node:child_process';

// Empties the user-data tables in the throwaway e2e database, so the journey starts from
// "nothing solved" on every run (local re-runs, CI retries). Content tables (topics,
// topic_edges) and alembic_version are kept. `users` CASCADE also empties every table that
// points at it; the tables are listed anyway so a new one is a visible decision.
const USER_TABLES = [
  'users',
  'identities',
  'oauth_states',
  'login_codes',
  'refresh_tokens',
  'submissions',
  'applications',
  'job_profiles',
  'question_notes',
  'flashcards',
  'card_reviews',
  'notes',
  'prep_plans',
  'progress',
  'solved_problems',
  'activity_events',
  'chat_sessions',
  'chat_messages',
];

export default function globalSetup(): void {
  // Same variable as playwright.config.ts. SQLAlchemy's "+asyncpg" driver tag is not a libpq URL.
  const raw = process.env['E2E_DATABASE_URL'] ?? 'postgresql+asyncpg://localhost:5432/cortex_e2e';
  const url = new URL(raw.replace('+asyncpg', ''));
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]*_e2e$/.test(name)) {
    throw new Error(`Refusing to empty "${name}": the e2e database name must end in _e2e.`);
  }
  // Locally there is no user or password (psql uses the current user); in CI they are in the URL.
  execFileSync(
    'psql',
    [url.toString(), '-v', 'ON_ERROR_STOP=1', '-c', `TRUNCATE ${USER_TABLES.join(', ')} CASCADE`],
    { stdio: 'inherit' },
  );
}
