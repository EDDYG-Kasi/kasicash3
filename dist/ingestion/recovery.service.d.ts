import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IngestionService } from './ingestion.service';
export declare class RecoveryService implements OnModuleInit, OnModuleDestroy {
    private dataSource;
    private ingestion;
    private readonly logger;
    private timer?;
    private running;
    private readonly intervalMs;
    private readonly staleReceivedMs;
    private readonly batchSize;
    constructor(dataSource: DataSource, ingestion: IngestionService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    runRecoveryCycle(): Promise<{
        recovered: number;
    }>;
}
