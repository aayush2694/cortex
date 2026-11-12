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
  state: Record<string, any>;
  highlight: any[];
  counters: Record<string, number>;
}

export interface Trace {
  algorithm: string;
  view: View;
  source: string[];
  input: Record<string, any>;
  frames: Frame[];
  result: Record<string, any>;
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
