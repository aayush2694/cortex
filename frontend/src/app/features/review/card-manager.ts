import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';

import { Api, errorMessage } from '../../core/api/api';
import { Flashcard } from '../../core/api/models';
import { formatInterval } from '../../shared/format';

/** Your flashcards, with edit (wording only; the schedule is kept) and delete. */
@Component({
  selector: 'app-card-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list">
      @for (c of list(); track c.id) {
        <div class="list-row card-row">
          @if (editing() === c.id) {
            <form class="edit" (submit)="save($event, c)">
              <textarea class="input" name="front" rows="2" aria-label="Question" [value]="front()" (input)="front.set(val($event))"></textarea>
              <textarea class="input" name="back" rows="3" aria-label="Answer" [value]="back()" (input)="back.set(val($event))"></textarea>
              <div class="actions">
                <button class="btn ghost" type="button" (click)="editing.set(null)">Cancel</button>
                <button class="btn primary" type="submit" [disabled]="!front().trim() || !back().trim()">Save</button>
              </div>
            </form>
          } @else {
            <span class="row-main">
              <span class="front">{{ c.front }}</span>
              <span class="faint">{{ dueLabel(c) }}</span>
            </span>
            <button class="btn ghost small" (click)="startEdit(c)">Edit</button>
            <button class="btn ghost small" (click)="remove(c)">{{ confirming() === c.id ? 'Delete for good?' : 'Delete' }}</button>
          }
        </div>
      } @empty {
        <div class="list-row plain"><span class="muted">No cards yet.</span></div>
      }
    </div>
    @if (error()) {
      <p class="faint">{{ error() }}</p>
    }
  `,
  styles: `
    .card-row {
      align-items: flex-start;
    }
    .front {
      white-space: pre-wrap;
    }
    .small {
      height: 26px;
      padding: 0 10px;
      font-size: 12.5px;
    }
    .edit {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      textarea {
        height: auto;
        resize: vertical;
        padding: 8px 10px;
        line-height: 1.5;
      }
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class CardManager {
  readonly cards = input.required<Flashcard[]>();
  /** A card's new wording, so a review session in progress shows it. */
  readonly edited = output<Flashcard>();
  /** A deleted card's id, so a review session in progress can drop it. */
  readonly deleted = output<number>();

  private readonly api = inject(Api);
  protected readonly list = linkedSignal(() => this.cards());
  protected readonly editing = signal<number | null>(null);
  protected readonly confirming = signal<number | null>(null);
  protected readonly front = signal('');
  protected readonly back = signal('');
  protected readonly error = signal('');

  protected val(e: Event): string {
    return (e.target as HTMLTextAreaElement).value;
  }

  protected dueLabel(c: Flashcard): string {
    const days = (new Date(c.due_at).getTime() - Date.now()) / 86_400_000;
    return days <= 0 ? 'Due now' : `Due in ${formatInterval(days)}`;
  }

  protected startEdit(c: Flashcard): void {
    this.confirming.set(null);
    this.front.set(c.front);
    this.back.set(c.back);
    this.editing.set(c.id);
  }

  protected async save(event: Event, c: Flashcard): Promise<void> {
    event.preventDefault();
    try {
      const updated = await this.api.editCard(c.id, { front: this.front().trim(), back: this.back().trim() });
      this.list.update((all) => all.map((x) => (x.id === c.id ? updated : x)));
      this.editing.set(null);
      this.edited.emit(updated);
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't save the card"));
    }
  }

  protected async remove(c: Flashcard): Promise<void> {
    if (this.confirming() !== c.id) {
      this.confirming.set(c.id);
      return;
    }
    try {
      await this.api.deleteCard(c.id);
      this.list.update((all) => all.filter((x) => x.id !== c.id));
      this.confirming.set(null);
      this.deleted.emit(c.id);
    } catch (err) {
      this.error.set(errorMessage(err, "Couldn't delete the card"));
    }
  }
}
