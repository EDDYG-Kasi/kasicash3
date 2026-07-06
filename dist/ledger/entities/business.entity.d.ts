import { Account } from './account.entity';
import { Transaction } from './transaction.entity';
export declare class Business {
    id: string;
    name: string;
    waPhone: string;
    createdAt: Date;
    accounts: Account[];
    transactions: Transaction[];
}
