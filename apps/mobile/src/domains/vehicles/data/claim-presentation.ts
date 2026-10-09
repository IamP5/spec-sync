import { displayValue } from '../util/vehicle-display';

/**
 * Presentation of extracted claims shared by the ingestion review and the
 * research evidence (a port of the web `claim-presentation.ts`). Everything a
 * claim carries beyond its structured fields — qualifiers, locators, issues,
 * warnings — is agent-facing text in the source language; these helpers
 * translate the codes the extractor emits deterministically and format the
 * normalized values through the viewer's locale.
 */

/** User-visible text is English only for now (ADR-0005). */
export const DISPLAY_LOCALE = 'en-US';

/** Canonical attribute units that denote an amount of money. */
const CURRENCY_UNITS = new Set(['BRL', 'USD', 'EUR']);

function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(Math.round(value * 100) / 100);
  }
}

function formatCurrency(value: number, unit: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: unit,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${unit} ${formatNumber(value, locale)}`;
  }
}

/**
 * A normalized value with its canonical unit, formatted for `locale`.
 * Numbers are rounded to two decimals for display; the stored value keeps
 * its full precision.
 */
export function formatMeasurement(
  value: unknown,
  unit: string | null | undefined,
  locale: string,
): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (unit && CURRENCY_UNITS.has(unit))
      return formatCurrency(value, unit, locale);
    return `${formatNumber(value, locale)}${unit ? ` ${unit}` : ''}`;
  }
  return `${displayValue(value)}${unit ? ` ${unit}` : ''}`;
}

export function availabilityLabel(value: string): string {
  return (
    (
      {
        STANDARD: 'Standard',
        OPTIONAL: 'Optional',
        ABSENT: 'Absent',
        NOT_APPLICABLE: 'Not applicable',
      } as Record<string, string>
    )[value] ?? value
  );
}

/**
 * Qualifier names the extractor and the API use deterministically. Other
 * names are chosen by the model while reading the source and are shown as
 * they come, with their source-text value.
 */
function qualifierLabel(name: string): string {
  return (
    (
      {
        scope: 'Scope',
        rpm: 'Engine speed',
        fuel: 'Fuel',
        package: 'Package',
        column: 'Source column',
        footnote: 'Footnote',
        condition: 'Conditions',
        conditions: 'Conditions',
        braking: 'Braking',
        brakingCondition: 'Braking',
        driverIncluded: 'Driver included',
        trim: 'Trim',
        engine: 'Engine',
        transmission: 'Transmission',
        drivetrain: 'Drivetrain',
        market: 'Market',
        modelYear: 'Model year',
        note: 'Note',
      } as Record<string, string>
    )[name] ?? name
  );
}

/** Coded qualifier values the API guarantees; source wording stays as printed. */
function qualifierValue(value: string): string {
  return (
    (
      {
        UNKNOWN: 'Not stated by the source',
        YES: 'Yes',
        NO: 'No',
      } as Record<string, string>
    )[value] ?? value
  );
}

/** The conditions under which a claim holds, one line per claim. */
export function formatQualifiers(qualifiers: Record<string, string>): string {
  return Object.entries(qualifiers)
    .map(([name, value]) =>
      name === 'scope' && value === 'model'
        ? 'Stated for the whole model range'
        : `${qualifierLabel(name)}: ${qualifierValue(value)}`,
    )
    .join(' · ');
}

/**
 * Where the extractor found the value (page, table, row, column), unless the
 * locator only repeats the cited line range, which the caller already prints.
 */
export function claimLocator(claim: {
  locator: string;
  lineStart: number;
  lineEnd: number;
}): string {
  const locator = claim.locator.trim();
  return /^lines?\s*\d+(?:\s*[-–—]\s*\d+)?\.?$/i.test(locator) ? '' : locator;
}
