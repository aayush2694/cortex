import { TestBed } from '@angular/core/testing';

import { TopicGuide } from './topic-guide';

describe('TopicGuide', () => {
  async function render(guide: string) {
    const fixture = TestBed.createComponent(TopicGuide);
    fixture.componentRef.setInput('guide', guide);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders an "On this page" link and a heading per section', async () => {
    history.pushState(null, '', '/topics/binary-search');
    const el = await render('## In short\n\nHalve it.\n\n## Code\n\n```python\nx = 1\n```\n');
    const links = [...el.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    // Full path, so new-tab, middle-click and "copy link" stay on this topic.
    expect(links).toEqual(['/topics/binary-search#guide-in-short', '/topics/binary-search#guide-code']);
    const headings = [...el.querySelectorAll('h2')].map((h) => [h.id, h.textContent?.trim()]);
    expect(headings).toEqual([
      ['guide-in-short', 'In short'],
      ['guide-code', 'Code'],
    ]);
    expect(el.querySelector('pre code')?.textContent).toContain('x = 1');
  });

  it('does not run HTML hidden in a guide', async () => {
    const el = await render(
      '## In short\n\n<img src=x onerror="window.__x=1"><script>window.__y=1</script>\n',
    );
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull();
  });

  it('scrolls to the section instead of navigating away', async () => {
    const el = await render('## In short\n\nA\n\n## Code\n\nB\n');
    const heading = el.querySelector<HTMLElement>('#guide-code')!;
    let scrolled = false;
    heading.scrollIntoView = () => {
      scrolled = true;
    };
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelectorAll('nav a')[1].dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(scrolled).toBe(true);
    expect(document.activeElement).toBe(heading);
  });

  it('leaves Cmd/Ctrl-clicks to the browser', async () => {
    const el = await render('## In short\n\nA\n');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    el.querySelector('nav a')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it('joins wrapped lines into one paragraph', async () => {
    const el = await render('## In short\n\nFirst half of a sentence\nand its second half.\n');
    expect(el.querySelector('.md br')).toBeNull();
    expect(el.querySelector('.md p')?.textContent).toBe(
      'First half of a sentence\nand its second half.',
    );
  });
});
