import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api/api';
import { streamTutorReply } from '../../core/api/tutor-stream';
import { LearningStore } from '../../core/learning-store';
import { MarkdownPipe } from './markdown';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  state?: 'streaming' | 'error' | 'refused';
}

const STARTERS = [
  'Explain this like I already know the basics',
  'Give me a practice question',
  'What do interviewers ask about this?',
  'What mistakes do people make here?',
];

@Component({
  selector: 'app-tutor',
  imports: [RouterLink, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutor.html',
  styleUrl: './tutor.scss',
})
export class Tutor {
  /** Route param `/tutor/:sessionId`. */
  readonly sessionId = input<string>();
  /** Query param `?topic=binary-search` to start a chat about a topic. */
  readonly topic = input<string>();
  /** Query param `?ask=...`: a message to start with (from "Ask the tutor" in Practice). */
  readonly ask = input<string>();

  private readonly api = inject(Api);
  private readonly location = inject(Location);
  private readonly store = inject(LearningStore);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  protected readonly sessions = this.api.chatSessions();
  protected readonly activeId = signal<string | null>(null);
  protected readonly messages = signal<UiMessage[]>([]);
  protected readonly loadingChat = signal(false);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  protected readonly starters = STARTERS;

  /** The topic of the open chat, or of the ?topic= link when starting a new one. */
  protected readonly topicId = signal<string | null>(null);
  protected readonly topicTitle = computed(() => {
    const id = this.topicId();
    return id ? (this.store.topicById().get(id)?.title ?? null) : null;
  });

  private abort?: AbortController;

  constructor() {
    // Open the chat named in the URL (or start fresh).
    effect(() => {
      const id = this.sessionId() ?? null;
      const topic = this.topic() ?? null;
      const ask = this.ask() ?? '';
      untracked(() => {
        void this.open(id, topic);
        if (!id && ask) this.draft.set(ask);
      });
    });

    // Keep the newest message in view.
    effect(() => {
      this.messages();
      queueMicrotask(() => {
        const el = this.scroller()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    inject(DestroyRef).onDestroy(() => this.abort?.abort());
  }

  protected async open(id: string | null, topic: string | null = null): Promise<void> {
    this.abort?.abort();
    this.busy.set(false);
    this.activeId.set(id);
    this.messages.set([]);
    this.topicId.set(topic);
    if (!id) return;
    this.loadingChat.set(true);
    try {
      const chat = await this.api.chat(id);
      this.topicId.set(chat.topic_id);
      this.messages.set(chat.messages.map((m) => ({ id: m.id, role: m.role, text: m.text })));
    } catch (err) {
      this.messages.set([
        { id: 'err', role: 'assistant', text: errorMessage(err, "Couldn't open this chat."), state: 'error' },
      ]);
    } finally {
      this.loadingChat.set(false);
    }
  }

  protected newChat(): void {
    this.location.replaceState('/tutor');
    void this.open(null, null);
  }

  /** A chat waiting for a second click to confirm deletion. */
  protected readonly confirmDelete = signal<string | null>(null);

  protected async deleteChat(id: string): Promise<void> {
    if (this.confirmDelete() !== id) {
      this.confirmDelete.set(id);
      return;
    }
    this.confirmDelete.set(null);
    try {
      await this.api.deleteChat(id);
      if (this.activeId() === id) this.newChat();
      this.sessions.reload();
    } catch (err) {
      this.messages.update((m) => [
        ...m,
        { id: 'err', role: 'assistant', text: errorMessage(err, "Couldn't delete that chat."), state: 'error' },
      ]);
    }
  }

  protected selectChat(id: string): void {
    this.location.replaceState(`/tutor/${id}`);
    void this.open(id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }

  protected autosize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  protected async send(text = this.draft()): Promise<void> {
    const message = text.trim();
    if (!message || this.busy()) return;
    this.busy.set(true);
    this.draft.set('');
    const box = this.box()?.nativeElement;
    if (box) box.style.height = 'auto';

    const replyId = crypto.randomUUID();
    this.messages.update((list) => [
      ...list,
      { id: crypto.randomUUID(), role: 'user', text: message },
      { id: replyId, role: 'assistant', text: '', state: 'streaming' },
    ]);
    const patch = (change: Partial<UiMessage>) =>
      this.messages.update((list) => list.map((m) => (m.id === replyId ? { ...m, ...change } : m)));

    try {
      let id = this.activeId();
      if (!id) {
        const chat = await this.api.createChat(this.topicId());
        id = chat.id;
        this.activeId.set(id);
        this.location.replaceState(`/tutor/${id}`);
      }

      this.abort = new AbortController();
      let reply = '';
      for await (const event of streamTutorReply(id, message, this.abort.signal)) {
        if (event.type === 'delta') {
          reply += event.text;
          patch({ text: reply });
        } else if (event.type === 'done') {
          patch({ state: undefined });
        } else if (event.type === 'refused') {
          patch({ text: event.message, state: 'refused' });
        } else if (event.type === 'error') {
          patch({ text: event.message, state: 'error' });
        }
      }
      this.sessions.reload();
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        patch({ text: errorMessage(err, "Couldn't reach the tutor. Try again."), state: 'error' });
      }
    } finally {
      this.messages.update((list) =>
        list.map((m) => (m.id === replyId && m.state === 'streaming' ? { ...m, state: undefined } : m)),
      );
      this.busy.set(false);
    }
  }

  protected relativeTime(iso: string): string {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }
}
