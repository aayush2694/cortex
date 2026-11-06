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

export type View = 'array' | 'grid' | 'graph';

export interface Algorithm {
  key: string;
  title: string;
  topic_id: string;
  view: View;
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
