import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerModule } from '../ledger/ledger.module';
import { ParsingService } from './parsing.service';
import { TransactionProposal } from './entities/transaction-proposal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionProposal]), LedgerModule],
  providers: [ParsingService],
  exports: [ParsingService],
})
export class ParsingModule {}
