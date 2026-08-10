import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { AnomalyAlert } from './entities/anomaly-alert.entity';
import { AnomalyService } from './anomaly.service';
import { AnomalyReconciliationService } from './anomaly-reconciliation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnomalyAlert]),
    AnalyticsModule,
    IngestionModule,
  ],
  providers: [AnomalyService, AnomalyReconciliationService],
  exports: [AnomalyService],
})
export class AnomalyModule {}
