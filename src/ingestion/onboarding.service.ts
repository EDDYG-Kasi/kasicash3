import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Business } from '../ledger/entities/business.entity';
import { Account, AccountType } from '../ledger/entities/account.entity';

/**
 * Zero-friction onboarding: the first message from an unknown WhatsApp number
 * creates a Business (keyed by wa_phone) with a minimal seed chart of accounts.
 * Concurrent first messages are resolved by the UQ_businesses_wa_phone
 * constraint: the loser refetches the winner.
 */
@Injectable()
export class OnboardingService {
  constructor(private dataSource: DataSource) {}

  async resolveOrCreateBusiness(
    waPhone: string,
    displayName?: string,
  ): Promise<{ business: Business; created: boolean }> {
    const existing = await this.dataSource.manager.findOne(Business, {
      where: { waPhone },
    });
    if (existing) return { business: existing, created: false };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const business = await queryRunner.manager.save(
        queryRunner.manager.create(Business, {
          name: sanitizeBusinessName(displayName) ?? `Trader ${waPhone}`,
          waPhone,
        }),
      );
      const seeds: Array<[string, string, AccountType]> = [
        ['Cash', '100', AccountType.ASSET],
        ['Sales', '400', AccountType.REVENUE],
        ['Expenses', '500', AccountType.EXPENSE],
      ];
      for (const [name, code, type] of seeds) {
        await queryRunner.manager.save(
          queryRunner.manager.create(Account, {
            name,
            code,
            type,
            businessId: business.id,
          }),
        );
      }
      await queryRunner.commitTransaction();
      return { business, created: true };
    } catch (err) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      const winner = await this.dataSource.manager.findOne(Business, {
        where: { waPhone },
      });
      if (winner) return { business: winner, created: false };
      throw err;
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release();
    }
  }
}

/**
 * WhatsApp profile.name is attacker-controlled. Strip control characters,
 * collapse whitespace, and cap length so it cannot produce distorted replies
 * or unbounded stored names. Returns undefined if nothing usable remains.
 */
function sanitizeBusinessName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ') // ASCII control chars
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '') // bidi override/isolate chars
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  // Code-point-safe truncation so surrogate pairs (e.g. emoji) are never split.
  const points = Array.from(cleaned);
  return points.length > 60 ? points.slice(0, 60).join('') : cleaned;
}
