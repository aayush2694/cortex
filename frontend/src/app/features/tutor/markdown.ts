import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Markdown → HTML for tutor replies.
 * The result is bound with [innerHTML], which Angular sanitizes (scripts and handlers are removed).
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(text: string | null | undefined): string {
    return text ? (marked.parse(text, { async: false }) as string) : '';
  }
}
