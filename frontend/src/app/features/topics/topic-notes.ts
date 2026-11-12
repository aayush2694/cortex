import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';

import { Api, errorMessage } from '../../core/api/api';
import { MarkdownPipe } from '../tutor/markdown';

const SAVE_DELAY_MS = 800;

/** Your own Markdown notes for a topic. Saves on its own a moment after you stop typing. */
@Component({
  selector: 'app-topic-notes',
  imports: [MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="group-label" id="notes">Your notes</span>
      <div class="segmented" role="tablist" aria-label="Notes view">
        <button role="tab" [attr.aria-selected]="!preview()" [class.on]="!preview()" (click)="preview.set(false)">Write</button>
        <button role="tab" [attr.aria-selected]="preview()" [class.on]="preview()" (click)="preview.set(true)">Preview</button>
      </div>
    </div>
    <div class="card">
      @if (preview()) {
        @if (body().trim()) {
          <div class="md" [innerHTML]="body() | markdown"></div>
        } @else {
          <p class="muted">Nothing written yet.</p>
        }
      } @else {
        <textarea
          class="input"
          rows="6"
          aria-labelledby="notes"
          placeholder="What clicked for you, gotchas, a link worth keeping… Markdown works."
          [value]="body()"
          (input)="onInput($any($event.target).value)"
        ></textarea>
      }
      <p class="faint status" aria-live="polite">{{ statusText() }}</p>
    </div>
  `,
  styles: `
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 28px;
      .group-label {
        padding-bottom: 0;
        scroll-margin-top: 80px;
      }
      .segmented {
        margin-bottom: 6px;
      }
    }
    textarea {
      width: 100%;
      height: auto;
      min-height: 120px;
      resize: vertical;
      padding: 10px 12px;
      line-height: 1.6;
      font-family: var(--font);
    }
    .md {
      line-height: 1.65;
      :first-child {
        margin-top: 0;
      }
    }
    .status {
      margin-top: 6px;
    }
  `,
})
export class TopicNotes {
  readonly topicId = input.required<string>();

  private readonly api = inject(Api);
  protected readonly note = this.api.note(this.topicId);
  protected readonly body = linkedSignal(() => this.note.value()?.body ?? '');
  protected readonly preview = signal(false);
  private readonly state = signal<'idle' | 'typing' | 'saving' | 'saved' | 'error'>('idle');
  private readonly error = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly statusText = computed(() => {
    switch (this.state()) {
      case 'typing':
        return 'Editing…';
      case 'saving':
        return 'Saving…';
      case 'saved':
        return 'Saved';
      case 'error':
        return this.error();
      default:
        return this.note.value()?.updated_at
          ? `Last edited ${new Date(this.note.value()!.updated_at!).toLocaleString()}`
          : 'Only you can see your notes.';
    }
  });

  constructor() {
    // Show the Preview first when there's already a note.
    effect(() => {
      if (this.note.value()?.body) this.preview.set(true);
    });
    inject(DestroyRef).onDestroy(() => this.flush());
  }

  protected onInput(text: string): void {
    this.body.set(text);
    this.state.set('typing');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  /** Save straight away (when leaving the page with unsaved typing). */
  private flush(): void {
    if (this.state() === 'typing') {
      clearTimeout(this.timer);
      void this.save();
    }
  }

  private async save(): Promise<void> {
    this.state.set('saving');
    try {
      await this.api.saveNote(this.topicId(), this.body());
      this.state.set('saved');
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't save your note. Keep this tab open and try again."));
      this.state.set('error');
    }
  }
}
