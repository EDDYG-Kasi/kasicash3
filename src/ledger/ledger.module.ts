import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerService } from './ledger.service';
import { Business } from './entities/business.entity';
import { Account } from './entities/account.entity';
import { Transaction } from './entities/transaction.entity';
import { Entry } from './entities/entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Business, Account, Transaction, Entry])],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
