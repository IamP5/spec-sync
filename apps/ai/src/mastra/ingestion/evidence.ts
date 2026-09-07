/** Longest inclusive line span one piece of evidence may cover. */
export const MAX_SPAN_LINES = 100;

/** The captured text with one-based line numbers, as the models see it. */
export function numberedLines(text: string): string {
  return text
    .split('\n')
    .map((line, index) => `${index + 1}: ${line}`)
    .join('\n');
}

/**
 * Exact text of an inclusive one-based line range, or undefined when the
 * range does not exist in the captured text. Evidence is never fabricated
 * from a model quotation: it is always cut from the stored source.
 */
export function excerptOf(
  text: string,
  start: number,
  end: number,
): string | undefined {
  const lines = text.split('\n');
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end < start ||
    end > lines.length ||
    end - start > MAX_SPAN_LINES
  )
    return undefined;
  return lines.slice(start - 1, end).join('\n');
}
