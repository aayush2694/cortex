import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Markdown → HTML for tutor replies, notes and topic guides.
 * The result is bound with [innerHTML], which Angular sanitizes (scripts and handlers are removed).
 * `breaks`: true turns every newline into a line break (chat-style); false joins wrapped lines into
 * one paragraph, for hand-wrapped files such as guides.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(text: string | null | undefined, breaks = true): string {
    return text ? (marked.parse(text, { async: false, breaks }) as string) : '';
  }
}
