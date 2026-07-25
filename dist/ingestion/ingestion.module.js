"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const inbound_message_entity_1 = require("./entities/inbound-message.entity");
const dev_controller_1 = require("./dev.controller");
const whatsapp_controller_1 = require("./whatsapp.controller");
const ingestion_service_1 = require("./ingestion.service");
const recovery_service_1 = require("./recovery.service");
const onboarding_service_1 = require("./onboarding.service");
const parsing_module_1 = require("../parsing/parsing.module");
const whatsapp_client_1 = require("./whatsapp.client");
let IngestionModule = class IngestionModule {
};
exports.IngestionModule = IngestionModule;
exports.IngestionModule = IngestionModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([inbound_message_entity_1.InboundMessage]), parsing_module_1.ParsingModule],
        controllers: [whatsapp_controller_1.WhatsAppController, dev_controller_1.DevController],
        providers: [
            ingestion_service_1.IngestionService,
            recovery_service_1.RecoveryService,
            onboarding_service_1.OnboardingService,
            {
                provide: whatsapp_client_1.WHATSAPP_CLIENT,
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const token = config.get('WHATSAPP_ACCESS_TOKEN');
                    const phoneNumberId = config.get('WHATSAPP_PHONE_NUMBER_ID');
                    return token && phoneNumberId
                        ? new whatsapp_client_1.CloudApiWhatsAppClient(token, phoneNumberId)
                        : new whatsapp_client_1.LoggingWhatsAppClient();
                },
            },
        ],
        exports: [ingestion_service_1.IngestionService],
    })
], IngestionModule);
//# sourceMappingURL=ingestion.module.js.map