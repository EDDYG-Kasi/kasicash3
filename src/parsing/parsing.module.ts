import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { ParsingService } from './parsing.service';

@Module({
  imports: [LedgerModule],
  providers: [ParsingService],
  exports: [ParsingService],
})
export class ParsingModule {}
