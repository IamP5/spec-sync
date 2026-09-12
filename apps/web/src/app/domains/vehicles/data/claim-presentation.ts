import {
  formatCurrency,
  formatNumber,
  getCurrencySymbol,
} from '@angular/common';

import { displayValue } from '../util/vehicle-display';

/**
 * Presentation of extracted claims shared by the ingestion review and the
 * research evidence. Everything a claim carries beyond its structured fields
 * — qualifiers, locators, issues, warnings — is agent-facing text in the
 * source language (see `docs/architecture-boundaries.md`, "Internationalization");
 * these helpers translate the codes the extractor emits deterministically and
 * format the normalized values through the viewer's locale.
 */

/** Canonical attribute units that denote an amount of money. */
const CURRENCY_UNITS = new Set(['BRL', 'USD', 'EUR']);

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
      return formatCurrency(
        value,
        locale,
        getCurrencySymbol(unit, 'narrow', locale),
        unit,
        '1.0-2',
      );
    return `${formatNumber(value, locale, '1.0-2')}${unit ? ` ${unit}` : ''}`;
  }
  return `${displayValue(value)}${unit ? ` ${unit}` : ''}`;
}

export function availabilityLabel(value: string): string {
  return (
    (
      {
        STANDARD: $localize`Standard`,
        OPTIONAL: $localize`Optional`,
        ABSENT: $localize`Absent`,
        NOT_APPLICABLE: $localize`Not applicable`,
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
        scope: $localize`Scope`,
        rpm: $localize`Engine speed`,
        fuel: $localize`Fuel`,
        package: $localize`Package`,
        column: $localize`Source column`,
        footnote: $localize`Footnote`,
        condition: $localize`Conditions`,
        conditions: $localize`Conditions`,
        braking: $localize`Braking`,
        brakingCondition: $localize`Braking`,
        driverIncluded: $localize`Driver included`,
        trim: $localize`Trim`,
        engine: $localize`Engine`,
        transmission: $localize`Transmission`,
        drivetrain: $localize`Drivetrain`,
        market: $localize`Market`,
        modelYear: $localize`Model year`,
        note: $localize`Note`,
      } as Record<string, string>
    )[name] ?? name
  );
}

/** Coded qualifier values the API guarantees; source wording stays as printed. */
function qualifierValue(value: string): string {
  return (
    (
      {
        UNKNOWN: $localize`Not stated by the source`,
        YES: $localize`Yes`,
        NO: $localize`No`,
      } as Record<string, string>
    )[value] ?? value
  );
}

/** The conditions under which a claim holds, one line per claim. */
export function formatQualifiers(qualifiers: Record<string, string>): string {
  return Object.entries(qualifiers)
    .map(([name, value]) =>
      name === 'scope' && value === 'model'
        ? $localize`Stated for the whole model range`
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
