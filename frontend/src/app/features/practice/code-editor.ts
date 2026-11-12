import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { SQLite, sql } from '@codemirror/lang-sql';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { basicSetup } from 'codemirror';

/** Monochrome syntax colours: keywords bright, strings and comments dimmer. */
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.operatorKeyword], color: 'var(--tone-1)', fontWeight: '600' },
  { tag: [t.typeName, t.standard(t.name)], color: 'var(--tone-1)' },
  { tag: [t.function(t.variableName), t.function(t.definition(t.variableName))], color: 'var(--tone-1)' },
  { tag: [t.string, t.number, t.bool, t.null], color: 'var(--tone-2)' },
  { tag: t.comment, color: 'var(--text-3)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--text-2)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.7' },
  '.cm-content': { caretColor: 'var(--text)', padding: '10px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--text-3)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--hover)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--text)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selected) !important',
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--selected)', outline: 'none' },
  '.cm-tooltip': { backgroundColor: 'var(--raised)', border: '0.5px solid var(--border-strong)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--selected)',
    color: 'var(--text)',
  },
});

const languageFor = (lang: 'python' | 'sql') => (lang === 'sql' ? sql({ dialect: SQLite }) : python());

/** A code editor (CodeMirror 6) for Python or SQL. `value` is two-way bound. */
@Component({
  selector: 'app-code-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  host: { class: 'code-editor', '[attr.aria-label]': 'label()' },
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 240px;
      overflow: hidden;
    }
  `,
})
export class CodeEditor {
  readonly value = model.required<string>();
  readonly label = input('Code editor');
  readonly language = input<'python' | 'sql'>('python');
  readonly submit = output<void>();
  readonly run = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private view: EditorView | null = null;
  private readonly lang = new Compartment();

  constructor() {
    afterNextRender(() => {
      this.view = new EditorView({
        parent: this.host.nativeElement,
        state: EditorState.create({
          doc: this.value(),
          extensions: [
            basicSetup,
            this.lang.of(languageFor(this.language())),
            indentUnit.of('    '),
            keymap.of([
              { key: 'Mod-Enter', run: () => (this.run.emit(), true) },
              { key: 'Mod-Shift-Enter', run: () => (this.submit.emit(), true) },
              indentWithTab,
            ]),
            syntaxHighlighting(highlight),
            theme,
            EditorView.contentAttributes.of({ 'aria-label': this.label() }),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) this.value.set(u.state.doc.toString());
            }),
          ],
        }),
      });
    });

    // Switching between a Python and a SQL problem swaps the highlighting.
    effect(() => {
      const lang = this.language();
      this.view?.dispatch({ effects: this.lang.reconfigure(languageFor(lang)) });
    });

    // Outside changes (Reset, a different problem) replace the document.
    effect(() => {
      const next = this.value();
      const view = this.view;
      if (view && view.state.doc.toString() !== next) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
      }
    });

    inject(DestroyRef).onDestroy(() => this.view?.destroy());
  }

  /** Put the cursor in the editor. */
  focus(): void {
    this.view?.focus();
  }
}
