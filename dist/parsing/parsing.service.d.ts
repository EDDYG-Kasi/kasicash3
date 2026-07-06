import { DataSource } from 'typeorm';
import { LedgerService } from '../ledger/ledger.service';
export interface ParseAndPostInput {
    businessId: string;
    waMessageId: string;
    payloadHash: string;
    textBody?: string | null;
    messageType: string;
    waTimestamp: Date;
    receivedAt: Date;
}
export type ParseAndPostResult = {
    status: 'UNRECOGNIZED';
} | {
    status: 'POSTED';
    kind: ParsedTransactionKind;
    amountMinor: string;
    transactionId: string;
};
export type ParsedTransactionKind = 'SALE' | 'EXPENSE';
interface ParsedTransaction {
    kind: ParsedTransactionKind;
    amountMinor: string;
    description: string;
}
export declare class ParsingService {
    private dataSource;
    private ledger;
    constructor(dataSource: DataSource, ledger: LedgerService);
    parseAndPost(input: ParseAndPostInput): Promise<ParseAndPostResult>;
    private loadSeedAccounts;
}
export declare function parseTransactionText(textBody?: string | null, messageType?: string): ParsedTransaction | null;
export {};
