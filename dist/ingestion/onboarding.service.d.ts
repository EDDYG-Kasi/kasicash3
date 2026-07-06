import { DataSource } from 'typeorm';
import { Business } from '../ledger/entities/business.entity';
export declare class OnboardingService {
    private dataSource;
    constructor(dataSource: DataSource);
    resolveOrCreateBusiness(waPhone: string, displayName?: string): Promise<{
        business: Business;
        created: boolean;
    }>;
}
