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
exports.WhatsAppController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ingestion_service_1 = require("./ingestion.service");
const whatsapp_signature_util_1 = require("./whatsapp-signature.util");
let WhatsAppController = class WhatsAppController {
    ingestion;
    config;
    constructor(ingestion, config) {
        this.ingestion = ingestion;
        this.config = config;
    }
    verify(mode, token, challenge) {
        const expected = this.config.get('WHATSAPP_VERIFY_TOKEN');
        if (mode === 'subscribe' && expected && token === expected) {
            return challenge;
        }
        throw new common_1.ForbiddenException('Webhook verification failed');
    }
    async receive(req, body, signature) {
        const secret = this.config.get('WHATSAPP_APP_SECRET');
        if (!secret ||
            !req.rawBody ||
            !(0, whatsapp_signature_util_1.verifyWhatsAppSignature)(secret, req.rawBody, signature)) {
            throw new common_1.UnauthorizedException('Invalid webhook signature');
        }
        await this.ingestion.ingestWebhook(body, req.rawBody);
        return 'EVENT_RECEIVED';
    }
};
exports.WhatsAppController = WhatsAppController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", String)
], WhatsAppController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-hub-signature-256')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], WhatsAppController.prototype, "receive", null);
exports.WhatsAppController = WhatsAppController = __decorate([
    (0, common_1.Controller)('webhooks/whatsapp'),
    __metadata("design:paramtypes", [ingestion_service_1.IngestionService,
        config_1.ConfigService])
], WhatsAppController);
//# sourceMappingURL=whatsapp.controller.js.map