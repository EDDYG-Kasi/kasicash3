"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWhatsAppSignature = verifyWhatsAppSignature;
const crypto_1 = require("crypto");
function verifyWhatsAppSignature(appSecret, rawBody, signatureHeader) {
    if (!signatureHeader || !signatureHeader.startsWith('sha256='))
        return false;
    const expected = (0, crypto_1.createHmac)('sha256', appSecret).update(rawBody).digest();
    const provided = Buffer.from(signatureHeader.slice('sha256='.length), 'hex');
    if (provided.length !== expected.length || expected.length === 0)
        return false;
    return (0, crypto_1.timingSafeEqual)(expected, provided);
}
//# sourceMappingURL=whatsapp-signature.util.js.map