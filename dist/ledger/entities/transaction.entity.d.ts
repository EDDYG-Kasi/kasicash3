import { Business } from './business.entity';
import { Entry } from './entry.entity';
export declare class Transaction {
    id: string;
    description: string;
    currency: string;
    idempotencyKey: string;
    sourceType: string;
    sourceMessageId: string;
    sourcePayloadHash: string;
    occurredAt: Date;
    receivedAt: Date;
    postedAt: Date;
    status: string;
    reversalOfTransaction: Transaction;
    reversalOfTransactionId: string;
    business: Business;
    businessId: string;
    createdAt: Date;
    entries: Entry[];
}
