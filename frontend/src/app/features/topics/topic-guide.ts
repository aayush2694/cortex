import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { MarkdownPipe } from '../tutor/markdown';
import { splitGuide } from './guide-format';

/** A topic's written guide: an "On this page" list, then one section per `## ` heading. */
@Component({
  selector: 'app-topic-guide',
  imports: [MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Not encapsulated: the guide's HTML comes from [innerHTML], which scoped styles can't reach.
  // Every rule is nested under the element name instead.
  encapsulation: ViewEncapsulation.None,
  template: `
    <nav class="toc" aria-label="On this page">
      <span class="toc-label">On this page</span>
      @for (s of sections(); track s.id) {
        <a [href]="pagePath() + '#' + s.id" (click)="jump($event, s.id)">{{ s.title }}</a>
      }
    </nav>
    @for (s of sections(); track s.id) {
      <section class="section" [attr.aria-labelledby]="s.id">
        <h2 [id]="s.id" tabindex="-1">{{ s.title }}</h2>
        <div class="md" [innerHTML]="s.body | markdown: false"></div>
      </section>
    }
  `,
  styles: `
    app-topic-guide {
      display: block;
      margin-bottom: 32px;
      .toc {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px 14px;
        padding-bottom: 16px;
        margin-bottom: 8px;
        border-bottom: 0.5px solid var(--border);
        font-size: 13px;
        a {
          color: var(--text-2);
          &:hover {
            color: var(--text);
          }
        }
      }
      .toc-label {
        font-weight: 600;
        color: var(--text);
      }
      .section {
        scroll-margin-top: 72px; // clears the 52px sticky top bar
      }
      h2 {
        outline: none;
        font-size: 21px;
        margin: 28px 0 10px;
        scroll-margin-top: 72px; // clears the 52px sticky top bar
      }
      .md {
        font-size: 16px;
        line-height: 1.65;
        max-width: 68ch;
        :first-child {
          margin-top: 0;
        }
        p,
        ul,
        ol {
          margin: 0 0 12px;
        }
        li + li {
          margin-top: 4px;
        }
        code {
          padding: 1px 5px;
          border-radius: 5px;
          background: var(--raised);
        }
        pre {
          margin: 0 0 14px;
          padding: 14px 16px;
          border-radius: var(--radius);
          background: var(--raised);
          overflow-x: auto;
          line-height: 1.55;
          code {
            padding: 0;
            background: none;
          }
        }
      }
    }
  `,
})
export class TopicGuide {
  readonly guide = input.required<string>();
  protected readonly sections = computed(() => splitGuide(this.guide()));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  /** Current path, recomputed with each guide, so links work in a new tab or when copied. */
  protected readonly pagePath = computed(() => {
    this.guide();
    return this.document.location.pathname;
  });

  /** Plain clicks scroll in place; Cmd/Ctrl/Shift/middle clicks are left to the browser. */
  protected jump(event: MouseEvent, id: string): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const heading = this.host.nativeElement.querySelector<HTMLElement>(`#${id}`);
    if (!heading) return;
    event.preventDefault();
    const smooth = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    heading.focus({ preventScroll: true });
  }
}
