import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { LedgerModule } from './ledger/ledger.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'kasicash'),
        autoLoadEntities: true,
        synchronize: false, // Strict migration control
      }),
      inject: [ConfigService],
    }),
    LedgerModule,
    IngestionModule,
    ReportsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
