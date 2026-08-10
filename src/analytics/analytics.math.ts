import { BadRequestException } from '@nestjs/common';
import { AnalyticsGranularity } from './analytics.dto';

const BUCKET_INTERVALS: Record<AnalyticsGranularity, string> = {
  day: '1 day',
  week: '1 week',
  month: '1 month',
};

export function normalizeGranularity(raw: string): AnalyticsGranularity {
  if (raw === 'day' || raw === 'week' || raw === 'month') {
    return raw;
  }
  throw new BadRequestException('granularity must be day, week, or month');
}

export function bucketInterval(granularity: AnalyticsGranularity): string {
  return BUCKET_INTERVALS[granularity];
}
