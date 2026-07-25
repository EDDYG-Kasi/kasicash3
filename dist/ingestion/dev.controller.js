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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ingestion_service_1 = require("./ingestion.service");
let DevController = class DevController {
    ingestion;
    config;
    constructor(ingestion, config) {
        this.ingestion = ingestion;
        this.config = config;
    }
    async simulateWhatsAppText(body) {
        if (this.config.get('KASICASH_DEV_TOOLS') !== 'true') {
            throw new common_1.ForbiddenException('Developer tools are disabled');
        }
        const text = requiredTrimmedString(body?.text, 'text', 1000);
        const from = normalizeWaPhone(body?.from);
        const contactName = optionalTrimmedString(body?.contactName, 60);
        const messageId = optionalTrimmedString(body?.messageId, 120);
        const result = await this.ingestion.ingestSyntheticText({
            from,
            text,
            contactName,
            messageId,
        });
        return {
            ok: true,
            ...result,
        };
    }
};
exports.DevController = DevController;
__decorate([
    (0, common_1.Post)('whatsapp/text'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DevController.prototype, "simulateWhatsAppText", null);
exports.DevController = DevController = __decorate([
    (0, common_1.Controller)('dev'),
    __metadata("design:paramtypes", [ingestion_service_1.IngestionService,
        config_1.ConfigService])
], DevController);
function normalizeWaPhone(raw) {
    const value = optionalTrimmedString(raw, 32) ?? '27831234567';
    const digits = value.replace(/[^\d]/g, '');
    if (!/^\d{8,15}$/.test(digits)) {
        throw new common_1.BadRequestException('from must be an 8 to 15 digit WhatsApp phone number');
    }
    return digits;
}
function requiredTrimmedString(raw, field, maxLength) {
    const value = optionalTrimmedString(raw, maxLength);
    if (!value)
        throw new common_1.BadRequestException(`${field} is required`);
    return value;
}
function optionalTrimmedString(raw, maxLength) {
    if (raw === undefined || raw === null)
        return undefined;
    if (typeof raw !== 'string') {
        throw new common_1.BadRequestException('Request fields must be strings');
    }
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value)
        return undefined;
    return value.slice(0, maxLength);
}
//# sourceMappingURL=dev.controller.js.map