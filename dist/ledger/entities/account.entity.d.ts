import { Business } from './business.entity';
import { Entry } from './entry.entity';
export declare enum AccountType {
    ASSET = "ASSET",
    LIABILITY = "LIABILITY",
    EQUITY = "EQUITY",
    REVENUE = "REVENUE",
    EXPENSE = "EXPENSE"
}
export declare class Account {
    id: string;
    name: string;
    code: string;
    type: string;
    business: Business;
    businessId: string;
    createdAt: Date;
    entries: Entry[];
}
