import { Pipe, PipeTransform } from '@angular/core';
import { completePartialMarkdown } from '@copilotkit/core';
import { marked } from 'marked';

/**
 * Renders assistant Markdown to HTML. Bind the result with `[innerHTML]`;
 * Angular sanitises it, so scripts and event handlers never reach the DOM.
 *
 * While a reply streams, unfinished code fences and links are closed first
 * so the partial text renders as the final text will, instead of flashing
 * raw back-ticks until the closing fence arrives.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(value: string | undefined | null, streaming = false): string {
    const text = value ?? '';
    const source = streaming ? completePartialMarkdown(text) : text;
    return marked.parse(source, {
      async: false,
      gfm: true,
      breaks: true,
    }) as string;
  }
}
