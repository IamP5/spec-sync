export function displayValue(value: unknown): string {
  return typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map(displayValue).join(', ')
      : value == null
        ? ''
        : JSON.stringify(value);
}
export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
