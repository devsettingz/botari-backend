export interface Client {
    id: string;
    name: string;
    apiKey: string;
    whatsappSessionId?: string;
    callPreferences?: {
        defaultVoice?: 'male' | 'female';
    };
}
//# sourceMappingURL=Client.d.ts.map