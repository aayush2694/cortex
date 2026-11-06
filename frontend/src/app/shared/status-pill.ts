import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Status } from '../core/api/models';

const LABELS: Record<Status, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  confident: 'Known',
};

const TONES: Record<Status, string> = { not_started: '', learning: 'warn', confident: 'ok' };

@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill {{ tone() }}">{{ label() }}</span>`,
})
export class StatusPill {
  readonly status = input<Status>('not_started');
  protected readonly label = computed(() => LABELS[this.status()]);
  protected readonly tone = computed(() => TONES[this.status()]);
}
