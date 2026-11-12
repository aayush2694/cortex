// Types matching the Cortex backend API (see backend/app/modules/*/schemas.py).

export type Track = 'dsa' | 'languages' | 'frameworks' | 'ai' | 'system-design';
export type Status = 'not_started' | 'learning' | 'confident';

export const TRACK_LABELS: Record<Track, string> = {
  dsa: 'DSA',
  languages: 'Languages',
  frameworks: 'Frameworks',
  ai: 'AI',
  'system-design': 'System design',
};

export interface Topic {
  id: string;
  track: Track;
  title: string;
  summary: string;
  difficulty: number;
  phase: number;
  visualizer: string | null;
  resources: Resource[];
  concepts: string[];
  pattern: Pattern | null;
}

export interface Problem {
  title: string;
  slug: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Pattern {
  group: string;
  complexity: string;
  walkthrough: string;
  signals: string[];
  template: string;
  problems: Problem[];
}

export function leetcodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

export interface Resource {
  label: string;
  url: string;
}

export interface KnowledgeMap {
  topics: Topic[];
  edges: { source: string; target: string }[];
}

export interface TopicDetail extends Topic {
  requires: Topic[];
  unlocks: Topic[];
}

export interface ProgressItem {
  topic_id: string;
  status: Status;
  mastery: number;
  last_activity_at: string | null;
}

export interface Recommendation {
  topic: Topic;
  priority: number;
  reason: string;
}

export type View = 'array' | 'grid' | 'graph' | 'sequence' | 'list' | 'tree' | 'intervals' | 'table';

export interface Algorithm {
  key: string;
  title: string;
  topic_id: string;
  view: View;
  kind: 'algorithm' | 'pattern';
  description: string;
  complexity: string;
  source: string[];
  example: Record<string, unknown>;
}

export interface Frame {
  line: number;
  action: string;
  message: string;
  state: Record<string, unknown>;
  highlight: unknown[];
  counters: Record<string, number>;
}

export interface Trace {
  algorithm: string;
  view: View;
  source: string[];
  input: Record<string, unknown>;
  frames: Frame[];
  result: Record<string, unknown>;
  stats: Record<string, number>;
}

export interface SolvedProblem {
  topic_id: string;
  slug: string;
  solved_at: string;
}

export interface ChatSession {
  id: string;
  topic_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

export interface ApiError {
  error: { code: string; message: string; request_id?: string; details?: unknown };
}

/** Mastery → a colour role used across the app. */
export function masteryTone(mastery: number): 'ok' | 'warn' | 'bad' | 'none' {
  if (mastery >= 0.7) return 'ok';
  if (mastery >= 0.4) return 'warn';
  if (mastery > 0) return 'bad';
  return 'none';
}

// ---------------------------------------------------------------- practice (code runner)

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface CodingProblemSummary {
  id: string;
  topic_id: string;
  title: string;
  difficulty: Difficulty;
  solved: boolean;
  attempts: number;
}

export interface TestCase {
  args: unknown[];
  expected: unknown;
  hidden: boolean;
}

export interface CodingProblem extends CodingProblemSummary {
  language: 'python' | 'sql';
  statement: string;
  function: string;
  params: string[];
  starter: string;
  compare: string;
  /** How each argument is built: plain, list (linked list), cycle_list or tree. */
  arg_types: string[] | null;
  /** How the return value is read back: plain, list or tree. */
  returns: string;
  cases: TestCase[];
  /** SQL problems: CREATE TABLE script, table -> columns, and the columns to return. */
  setup: string | null;
  tables: Record<string, string[]>;
  output_columns: string[];
  hints: string[];
  complexity: string;
}

export interface Solution {
  code: string;
  explanation: string;
  complexity: string;
}

export interface Submission {
  id: number;
  problem_id: string;
  passed: number;
  total: number;
  runtime_ms: number;
  accepted: boolean;
  created_at: string;
}

// ---------------------------------------------------------------- study tools

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: number;
  topic_id: string | null;
  kind: 'ideas' | 'signals' | 'template' | 'custom';
  front: string;
  back: string;
  reps: number;
  lapses: number;
  interval_days: number;
  due_at: string;
  last_reviewed_at: string | null;
  /** Days until the card comes back for each grade. */
  next: Record<Grade, number>;
}

export interface TopicNote {
  topic_id: string;
  body: string;
  updated_at: string | null;
}

export interface NoteSummary {
  topic_id: string;
  preview: string;
  updated_at: string;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface Activity {
  days: ActivityDay[];
  streak: number;
  longest_streak: number;
  active_days: number;
  total: number;
}

export interface PrepPlan {
  target_date: string | null;
  daily_problems: number;
  daily_cards: number;
  updated_at?: string | null;
}

export interface Today {
  date: string;
  problem: {
    id: string;
    title: string;
    topic_id: string;
    topic_title: string;
    difficulty: Difficulty;
    reason: string;
  } | null;
  solved_today: number;
  cards_due: number;
  reviewed_today: number;
  plan: PrepPlan;
  days_left: number | null;
  remaining_problems: number;
  pace: number | null;
  focus: { topic_id: string; title: string; reason: string } | null;
}

// ---------------------------------------------------------------- job search

export type Stage = 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface ApplicationFields {
  location: string | null;
  url: string | null;
  source: string | null;
  notes: string;
  applied_on: string | null;
  next_step: string | null;
  next_step_on: string | null;
  /** Offer details, in lakhs per annum. */
  fixed: number | null;
  variable: number | null;
  joining_bonus: number | null;
  stock_per_year: number | null;
}

export interface JobApplication extends ApplicationFields {
  id: number;
  company: string;
  role: string;
  status: Stage;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface MatchedSkill {
  name: string;
  category: string;
  /** False when the job lists it as nice to have. */
  required: boolean;
}

export interface SkillMatch {
  /** % of the job's required skills your resume mentions. */
  score: number;
  matched: MatchedSkill[];
  missing: MatchedSkill[];
  extra: MatchedSkill[];
}

export interface InterviewQuestion {
  id: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  answer: string;
  practised: boolean;
  my_answer: string;
  updated_at: string | null;
}

export interface QuestionBank {
  categories: { id: string; label: string }[];
  items: InterviewQuestion[];
}
