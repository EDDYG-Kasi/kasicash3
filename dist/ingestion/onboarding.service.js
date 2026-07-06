"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const business_entity_1 = require("../ledger/entities/business.entity");
const account_entity_1 = require("../ledger/entities/account.entity");
let OnboardingService = class OnboardingService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async resolveOrCreateBusiness(waPhone, displayName) {
        const existing = await this.dataSource.manager.findOne(business_entity_1.Business, {
            where: { waPhone },
        });
        if (existing)
            return { business: existing, created: false };
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const business = await queryRunner.manager.save(queryRunner.manager.create(business_entity_1.Business, {
                name: sanitizeBusinessName(displayName) ?? `Trader ${waPhone}`,
                waPhone,
            }));
            const seeds = [
                ['Cash', '100', account_entity_1.AccountType.ASSET],
                ['Sales', '400', account_entity_1.AccountType.REVENUE],
                ['Expenses', '500', account_entity_1.AccountType.EXPENSE],
            ];
            for (const [name, code, type] of seeds) {
                await queryRunner.manager.save(queryRunner.manager.create(account_entity_1.Account, {
                    name,
                    code,
                    type,
                    businessId: business.id,
                }));
            }
            await queryRunner.commitTransaction();
            return { business, created: true };
        }
        catch (err) {
            await queryRunner.rollbackTransaction().catch(() => undefined);
            const winner = await this.dataSource.manager.findOne(business_entity_1.Business, {
                where: { waPhone },
            });
            if (winner)
                return { business: winner, created: false };
            throw err;
        }
        finally {
            if (!queryRunner.isReleased)
                await queryRunner.release();
        }
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], OnboardingService);
function sanitizeBusinessName(raw) {
    if (!raw)
        return undefined;
    const cleaned = raw
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned)
        return undefined;
    const points = Array.from(cleaned);
    return points.length > 60 ? points.slice(0, 60).join('') : cleaned;
}
//# sourceMappingURL=onboarding.service.js.map