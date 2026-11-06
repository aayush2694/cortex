import { Injectable, computed, inject } from '@angular/core';

import { Api } from './api/api';
import { ProgressItem, Status, TRACK_LABELS, Topic, Track } from './api/models';

export interface TrackStat {
  track: Track;
  label: string;
  total: number;
  known: number;
  percent: number;
}

/** Shared, signal-based state for topics and your progress. One copy for the whole app. */
@Injectable({ providedIn: 'root' })
export class LearningStore {
  private readonly api = inject(Api);

  readonly map = this.api.knowledgeMap();
  readonly progressRes = this.api.progress();

  readonly topics = computed<Topic[]>(() => this.map.value()?.topics ?? []);
  readonly edges = computed(() => this.map.value()?.edges ?? []);
  readonly loading = computed(() => this.map.isLoading() || this.progressRes.isLoading());
  readonly error = computed(() => this.map.error() ?? this.progressRes.error());

  readonly topicById = computed(() => new Map(this.topics().map((t) => [t.id, t])));

  readonly progressById = computed(
    () => new Map((this.progressRes.value()?.items ?? []).map((p) => [p.topic_id, p])),
  );

  readonly knownCount = computed(
    () => [...this.progressById().values()].filter((p) => p.status === 'confident').length,
  );
  readonly learningCount = computed(
    () => [...this.progressById().values()].filter((p) => p.status === 'learning').length,
  );

  readonly trackStats = computed<TrackStat[]>(() => {
    const progress = this.progressById();
    return (Object.keys(TRACK_LABELS) as Track[]).map((track) => {
      const topics = this.topics().filter((t) => t.track === track);
      const mastery = topics.reduce((sum, t) => sum + (progress.get(t.id)?.mastery ?? 0), 0);
      const known = topics.filter((t) => progress.get(t.id)?.status === 'confident').length;
      return {
        track,
        label: TRACK_LABELS[track],
        total: topics.length,
        known,
        percent: topics.length ? Math.round((mastery / topics.length) * 100) : 0,
      };
    });
  });

  progressOf(topicId: string): ProgressItem | undefined {
    return this.progressById().get(topicId);
  }

  async setStatus(topicId: string, status: Status): Promise<void> {
    const updated = await this.api.setStatus(topicId, status);
    this.patch(updated);
  }

  async markVisualizerDone(topicId: string): Promise<void> {
    this.patch(await this.api.recordVisualizerDone(topicId));
  }

  /** Update one item locally, so the UI reacts instantly without refetching everything. */
  private patch(item: ProgressItem): void {
    this.progressRes.update((current) => ({
      items: (current?.items ?? []).map((p) => (p.topic_id === item.topic_id ? item : p)),
    }));
  }
}
