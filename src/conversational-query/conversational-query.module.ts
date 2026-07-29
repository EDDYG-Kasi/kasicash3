import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { ConversationalQueryService } from './conversational-query.service';
import {
  CONVERSATIONAL_QUERY_RESOLVER,
  HeuristicConversationalQueryResolver,
} from './conversational-query.resolver';

@Module({
  imports: [ReportsModule],
  providers: [
    ConversationalQueryService,
    {
      provide: CONVERSATIONAL_QUERY_RESOLVER,
      useClass: HeuristicConversationalQueryResolver,
    },
  ],
  exports: [ConversationalQueryService],
})
export class ConversationalQueryModule {}
