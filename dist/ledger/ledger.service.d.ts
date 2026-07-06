import { DataSource } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
export interface CreateTransactionDto {
    businessId: string;
    description: string;
    currency: string;
    idempotencyKey: string;
    sourceType: string;
    sourceMessageId?: string;
    sourcePayloadHash?: string;
    occurredAt: Date;
    receivedAt: Date;
    entries: {
        accountId: string;
        amountMinor: string;
        type: 'DEBIT' | 'CREDIT';
    }[];
}
export declare class LedgerService {
    private dataSource;
    constructor(dataSource: DataSource);
    postTransaction(dto: CreateTransactionDto): Promise<Transaction>;
    reverseTransaction(originalTransactionId: string, idempotencyKey: string, reason: string): Promise<Transaction>;
    private assertAccountsBelongToBusiness;
}
