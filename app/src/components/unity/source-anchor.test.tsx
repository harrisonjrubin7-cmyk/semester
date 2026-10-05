import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SourceDrawer } from './UnityLayer';

describe('source anchors', () => {
  it('shows the supplied excerpt, owner and precise location as escaped text', () => {
    const html = renderToStaticMarkup(<SourceDrawer detail={{title: 'Deadline', origin: 'course-provided', sourceName: 'Syllabus', excerpt: 'Due Friday <script>bad</script>', location: 'Page 3', owner: 'Course instructor'}} />);
    expect(html).toContain('Due Friday &lt;script&gt;bad&lt;/script&gt;');
    expect(html).toContain('Page 3');
    expect(html).toContain('Course instructor');
    expect(html).toContain('Supporting excerpt');
    expect(html).not.toContain('<script>');
  });
  it('does not invent an excerpt, owner or location when absent', () => {
    const html = renderToStaticMarkup(<SourceDrawer detail={{title: 'Unverified note', origin: 'yours'}} />);
    expect(html).not.toContain('Supporting excerpt');
    expect(html).not.toContain('Source owner');
    expect(html).not.toContain('Source location');
  });
});
