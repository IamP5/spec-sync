import { describe, expect, it } from 'vitest';

import {
  checkRequirementQuality,
  REQUIREMENT_QUALITY_TOOL_ID,
  requirementQualityTool,
} from './requirement-quality-tool';

describe('checkRequirementQuality', () => {
  it('accepts a precise, testable statement', () => {
    const result = checkRequirementQuality(
      'The system shall display the search results within 2 seconds for result sets of up to 500 rows.',
    );

    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('good');
  });

  it('flags vague terms, escape clauses and open-ended lists', () => {
    const result = checkRequirementQuality(
      'The system shall be fast and user-friendly and support PDF, DOCX, etc. where possible.',
    );

    const rules = result.findings.map((finding) => finding.rule);
    expect(rules).toContain('ambiguous-term');
    expect(rules).toContain('escape-clause');
    expect(rules).toContain('open-ended');
    expect(result.findings.find((f) => f.rule === 'escape-clause')).toEqual(
      expect.objectContaining({ severity: 'error', excerpt: 'where possible' }),
    );
    expect(result.verdict).toBe('poor');
  });

  it('flags a statement without a modal verb', () => {
    const result = checkRequirementQuality('Users log in with their email.');

    expect(result.findings.map((f) => f.rule)).toEqual(['no-modal-verb']);
    expect(result.score).toBe(80);
    expect(result.verdict).toBe('good');
  });

  it('flags compound statements', () => {
    const result = checkRequirementQuality(
      'The system shall export the report and it must email it to the owner.',
    );

    expect(result.findings.map((f) => f.rule)).toEqual(['compound']);
  });

  it('flags overly long statements', () => {
    const result = checkRequirementQuality(
      `The system shall ${'log every event '.repeat(20)}to the audit trail.`,
    );

    expect(result.findings.map((f) => f.rule)).toContain('too-long');
  });

  it('never returns a negative score', () => {
    const result = checkRequirementQuality(
      'Fast, easy, robust, flexible, scalable, seamless, etc. and so on, if possible, where appropriate.',
    );

    expect(result.score).toBe(0);
    expect(result.verdict).toBe('poor');
  });

  it('is exposed as the tool the web app renders', () => {
    expect(requirementQualityTool.id).toBe(REQUIREMENT_QUALITY_TOOL_ID);
    expect(REQUIREMENT_QUALITY_TOOL_ID).toBe('checkRequirementQuality');
  });
});
