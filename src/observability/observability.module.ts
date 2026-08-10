import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { CorrelationMiddleware } from './correlation.middleware';
import { CorrelationService } from './correlation.service';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { ObservabilityController } from './observability.controller';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { GracefulShutdownService } from './shutdown.service';
import { TelemetryLoggerService } from './telemetry-logger.service';

@Global()
@Module({
  imports: [AuthModule, IngestionModule],
  controllers: [ObservabilityController],
  providers: [
    CorrelationService,
    MetricsService,
    TelemetryLoggerService,
    GracefulShutdownService,
    HealthService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
  exports: [
    CorrelationService,
    MetricsService,
    TelemetryLoggerService,
    GracefulShutdownService,
    HealthService,
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
