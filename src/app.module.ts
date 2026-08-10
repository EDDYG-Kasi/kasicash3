import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { LedgerModule } from './ledger/ledger.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AnomalyModule } from './anomaly/anomaly.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { ObservabilityModule } from './observability/observability.module';
import { buildPostgresDataSourceOptions } from './database/database-options';
import { validateRuntimeConfiguration } from './config/runtime-config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        validateRuntimeConfiguration(process.env);
        return buildPostgresDataSourceOptions((name) =>
          configService.get<string>(name),
        );
      },
      inject: [ConfigService],
    }),
    ObservabilityModule,
    AuthModule,
    LedgerModule,
    IngestionModule,
    ReportsModule,
    AnalyticsModule,
    AnomalyModule,
    DashboardModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
