import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Status } from '../core/api/models';

const LABELS: Record<Status, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  confident: 'Known',
};

/**
 * Progress shown by shape, not colour: ● known, ◐ learning, ○ not started.
 * Works in a monochrome design and for colour-blind users.
 */
@Component({
  selector: 'app-status-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
    '[class]': 'status()',
  },
  template: ``,
  styles: `
    :host {
      display: inline-block;
      width: 11px;
      height: 11px;
      flex-shrink: 0;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1.5px var(--text);
      opacity: 0.9;
    }
    :host(.not_started) {
      box-shadow: inset 0 0 0 1.5px var(--text-2);
    }
    :host(.learning) {
      background: linear-gradient(90deg, var(--text) 50%, transparent 50%);
    }
    :host(.confident) {
      background: var(--text);
    }
  `,
})
export class StatusDot {
  readonly status = input<Status>('not_started');
  protected readonly label = computed(() => LABELS[this.status()]);
}
