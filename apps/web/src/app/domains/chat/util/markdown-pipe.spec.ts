import { MarkdownPipe } from './markdown-pipe';

describe('MarkdownPipe', () => {
  const pipe = new MarkdownPipe();

  it('renders GitHub-flavoured Markdown', () => {
    const html = pipe.transform('**bold** and `code`\n\n- item');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>item</li>');
  });

  it('renders an empty string for a missing value', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('closes an unfinished code fence while streaming', () => {
    const html = pipe.transform('```ts\nconst a = 1;', true);
    expect(html).toContain('<pre>');
    expect(html).not.toContain('```');
  });
});
