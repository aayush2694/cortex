import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  Algorithm,
  ChatSession,
  ChatSessionDetail,
  KnowledgeMap,
  ProgressItem,
  Recommendation,
  Status,
  TopicDetail,
  Trace,
} from './models';

export const API = '/api/v1';

/**
 * Reads use httpResource (signal-based, reloads when inputs change).
 * Writes use HttpClient and return promises.
 */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  // ---------------------------------------------------------------- reads (resources)

  knowledgeMap() {
    return httpResource<KnowledgeMap>(() => `${API}/topics`);
  }

  topic(id: Signal<string | undefined>) {
    return httpResource<TopicDetail>(() => (id() ? `${API}/topics/${id()}` : undefined));
  }

  progress() {
    return httpResource<{ items: ProgressItem[] }>(() => `${API}/progress`);
  }

  nextTopics(limit = 3) {
    return httpResource<{ items: Recommendation[] }>(() => `${API}/progress/next?limit=${limit}`);
  }

  algorithms() {
    return httpResource<{ items: Algorithm[] }>(() => `${API}/visualizer/algorithms`);
  }

  chatSessions() {
    return httpResource<{ items: ChatSession[] }>(() => `${API}/tutor/sessions`);
  }

  // ---------------------------------------------------------------- writes / one-off calls

  setStatus(topicId: string, status: Status) {
    return firstValueFrom(this.http.put<ProgressItem>(`${API}/progress/${topicId}`, { status }));
  }

  recordVisualizerDone(topicId: string) {
    return firstValueFrom(
      this.http.post<ProgressItem>(`${API}/progress/${topicId}/events`, {
        kind: 'visualizer_completed',
      }),
    );
  }

  trace(key: string, input: Record<string, unknown>) {
    return firstValueFrom(this.http.post<Trace>(`${API}/visualizer/${key}/trace`, { input }));
  }

  createChat(topicId: string | null) {
    return firstValueFrom(
      this.http.post<ChatSession>(`${API}/tutor/sessions`, { topic_id: topicId }),
    );
  }

  chat(id: string) {
    return firstValueFrom(this.http.get<ChatSessionDetail>(`${API}/tutor/sessions/${id}`));
  }
}

/** Pull a readable message out of an API error response. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const body = (err as { error?: { error?: { message?: string } } })?.error;
  return body?.error?.message ?? fallback;
}
