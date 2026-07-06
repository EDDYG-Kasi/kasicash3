import { Transaction } from './transaction.entity';
import { Account } from './account.entity';
export declare class Entry {
    id: string;
    amountMinor: string;
    type: string;
    businessId: string;
    transaction: Transaction;
    transactionId: string;
    account: Account;
    accountId: string;
    createdAt: Date;
}
