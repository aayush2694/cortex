/** One `## ` section of a topic guide. */
export interface GuideSection {
  id: string;
  title: string;
  body: string;
}

/** Split a guide's Markdown into its `## ` sections. Lines inside ``` code blocks are never headings. */
export function splitGuide(markdown: string): GuideSection[] {
  const sections: GuideSection[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) {
      const title = line.slice(3).trim();
      sections.push({ id: 'guide-' + slug(title), title, body: '' });
    } else if (sections.length) {
      sections[sections.length - 1].body += line + '\n';
    }
  }
  return sections;
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
