import { Vonage } from '@vonage/server-sdk';

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY!,
  apiSecret: process.env.VONAGE_API_SECRET!,
});

/**
 * Make a voice call using Vonage TTS
 * @param to - phone number to call
 * @param text - message to speak
 * @param voiceType - 'male' | 'female'
 */
export async function makeCall(to: string, text: string, voiceType: 'male' | 'female') {
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
    (vonage.voice as any).create(
      {
        to: [{ type: 'phone', number: to }],
        from: { type: 'phone', number: process.env.VONAGE_NUMBER },
        ncco,
      },
      (err: any, resp: any) => {
        if (err) reject(err);
        else resolve(resp);
      }
    );
  });
}
