import { TestBed } from '@angular/core/testing';

import { Tools } from './tools';

async function render() {
  const fixture = TestBed.createComponent(Tools);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

function type(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('Tools page', () => {
  it('lists every utility and starts on the JSON formatter', async () => {
    const { el } = await render();
    const names = [...el.querySelectorAll('nav button')].map((b) => b.textContent?.trim());
    expect(names).toEqual(['JSON formatter', 'Regex tester', 'JWT decoder', 'Base64 & URL', 'Timestamps', 'Hash & UUID']);
    expect(el.querySelector('h2')?.textContent).toContain('JSON formatter');
  });

  it('formats JSON as you type and shows errors', async () => {
    const { fixture, el } = await render();
    type(el, 'textarea', '{"a":1}');
    await fixture.whenStable();
    expect(el.querySelector('.output')?.textContent).toContain('"a": 1');

    type(el, 'textarea', '{"a":');
    await fixture.whenStable();
    expect(el.querySelector('.error')).not.toBeNull();
  });

  it('highlights regex matches', async () => {
    const { fixture, el } = await render();
    (el.querySelectorAll('nav button')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    type(el, 'input[name=pattern]', '\\d+');
    type(el, 'textarea', 'a1b22');
    await fixture.whenStable();
    expect([...el.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['1', '22']);
  });
});
