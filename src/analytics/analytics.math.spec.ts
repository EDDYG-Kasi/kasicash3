import { BadRequestException } from '@nestjs/common';
import { bucketInterval, normalizeGranularity } from './analytics.math';

describe('analytics math', () => {
  it('accepts only supported chart granularities', () => {
    expect(normalizeGranularity('day')).toBe('day');
    expect(normalizeGranularity('week')).toBe('week');
    expect(normalizeGranularity('month')).toBe('month');
    expect(() => normalizeGranularity('quarter')).toThrow(BadRequestException);
  });

  it('maps granularities to deterministic PostgreSQL intervals', () => {
    expect(bucketInterval('day')).toBe('1 day');
    expect(bucketInterval('week')).toBe('1 week');
    expect(bucketInterval('month')).toBe('1 month');
  });
});
