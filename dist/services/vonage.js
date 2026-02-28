"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeCall = makeCall;
const server_sdk_1 = require("@vonage/server-sdk");
const vonage = new server_sdk_1.Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET,
});
/**
 * Make a voice call using Vonage TTS
 * @param to - phone number to call
 * @param text - message to speak
 * @param voiceType - 'male' | 'female'
 */
async function makeCall(to, text, voiceType) {
    const voiceName = voiceType === 'male' ? 'Brian' : 'Emma';
    const ncco = [
        {
            action: 'talk',
            voiceName,
            text,
        },
    ];
    return new Promise((resolve, reject) => {
        // ✅ Cast to any to bypass TypeScript error
        vonage.voice.create({
            to: [{ type: 'phone', number: to }],
            from: { type: 'phone', number: process.env.VONAGE_NUMBER },
            ncco,
        }, (err, resp) => {
            if (err)
                reject(err);
            else
                resolve(resp);
        });
    });
}
//# sourceMappingURL=vonage.js.map