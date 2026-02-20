# Botari AI Voice Integration

Complete Voice Call Integration using Vonage for Botari AI.

## Features

- **Outbound Calls**: Make calls to customers with AI agent greeting
- **Inbound Calls**: Handle incoming calls with AI receptionist
- **Text-to-Speech (TTS)**: Convert AI responses to natural speech
- **Speech-to-Text (STT)**: Transcribe customer speech in real-time
- **Call Recording**: Record calls for quality assurance
- **Call Transfer**: Transfer calls to human agents
- **AI Integration**: Seamless integration with Botari AI agents (Omar, Rachel)
- **Analytics**: Call statistics and reporting

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vonage API    │◄───►│  Botari API      │◄───►│   AI Agent      │
│                 │     │                  │     │   (Omar/Rachel) │
└────────┬────────┘     └────────┬─────────┘     └─────────────────┘
         │                       │
         │ Webhooks              │ Database
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Voice Webhook  │     │  Calls Table     │
│  Routes         │     │  (PostgreSQL)    │
└─────────────────┘     └──────────────────┘
```

## Files Structure

```
src/
├── voice/
│   ├── VonageService.ts    # Main Vonage service class
│   ├── CallManager.ts      # Call session management
│   ├── WebhookHandler.ts   # Vonage webhook handlers
│   ├── index.ts            # Module exports
│   └── README.md           # This file
├── routes/
│   ├── calls.ts            # API routes for calls
│   └── voice-webhook.ts    # Vonage webhook endpoints
└── migrations/
    └── 004_voice_calls.sql # Database schema
```

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# Vonage API Credentials
VONAGE_API_KEY=your-api-key
VONAGE_API_SECRET=your-api-secret
VONAGE_APPLICATION_ID=your-application-id
VONAGE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
VONAGE_PHONE_NUMBER=+1234567890

# Webhook Configuration
WEBHOOK_BASE_URL=https://api.botari.ai
```

### 2. Database Migration

Run the migration to create the calls table:

```bash
psql $DATABASE_URL -f migrations/004_voice_calls.sql
```

### 3. Vonage Application Setup

1. Create a Vonage application in the [Vonage Dashboard](https://dashboard.nexmo.com/)
2. Enable Voice capability
3. Set webhook URLs:
   - **Answer URL**: `https://api.botari.ai/api/voice/webhook/answer`
   - **Event URL**: `https://api.botari.ai/api/voice/webhook/event/{callId}`
4. Link a phone number to the application
5. Download the private key and add it to your `.env`

## API Endpoints

### Make Outbound Call
```http
POST /api/calls/outbound
Authorization: Bearer {token}
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "employeeId": 1,
  "greetingText": "Hello, this is Omar from Botari...",
  "voiceName": "Joey"
}
```

### List Call History
```http
GET /api/calls?limit=20&offset=0&status=completed
Authorization: Bearer {token}
```

### Get Call Details
```http
GET /api/calls/:id
Authorization: Bearer {token}
```

### End Active Call
```http
POST /api/calls/:id/end
Authorization: Bearer {token}
```

### Start Recording
```http
POST /api/calls/:id/record
Authorization: Bearer {token}
```

### Transfer Call
```http
POST /api/calls/:id/transfer
Authorization: Bearer {token}
Content-Type: application/json

{
  "targetNumber": "+0987654321",
  "message": "Transferring to sales department"
}
```

### Get Call Analytics
```http
GET /api/calls/analytics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {token}
```

## Webhook Endpoints

These endpoints are called by Vonage during calls:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/voice/webhook/answer` | GET/POST | Initial call answering |
| `/api/voice/webhook/answer/:businessId` | GET/POST | Answer with specific business |
| `/api/voice/webhook/event/:callId` | POST | Call status updates |
| `/api/voice/webhook/input/:callId` | POST | Speech/DTMF input |
| `/api/voice/webhook/recording/:callId` | POST | Recording completed |
| `/api/voice/webhook/voicemail/:callId` | POST | Voicemail recording |
| `/api/voice/webhook/transfer/:callId` | POST | Transfer events |
| `/api/voice/webhook/machine-detection` | POST | Machine detection |
| `/api/voice/webhook/health` | GET | Health check |

## NCCO (Call Control Objects)

Vonage uses NCCO to control call flow:

### Talk (TTS)
```json
[
  {
    "action": "talk",
    "text": "Hello, this is Omar from Botari",
    "voiceName": "Joey",
    "language": "en-US",
    "premium": true
  }
]
```

### Input (Speech Recognition)
```json
[
  {
    "action": "input",
    "eventUrl": ["https://api.botari.ai/api/voice/webhook/input/123"],
    "speech": {
      "language": "en-US",
      "endOnSilence": 3
    },
    "type": ["speech"]
  }
]
```

### Record
```json
[
  {
    "action": "record",
    "eventUrl": ["https://api.botari.ai/api/voice/webhook/recording/123"],
    "beepStart": true,
    "endOnSilence": 5
  }
]
```

### Connect (Transfer)
```json
[
  {
    "action": "connect",
    "endpoint": [{"type": "phone", "number": "+1234567890"}],
    "from": "+0987654321"
  }
]
```

## AI Integration Flow

```
1. Call Started (Inbound/Outbound)
   ↓
2. NCCO Generated with Greeting
   ↓
3. Customer Speaks
   ↓
4. Speech Transcribed (STT)
   ↓
5. Text Sent to AI Agent (Omar/Rachel)
   ↓
6. AI Response Generated
   ↓
7. Response Converted to Speech (TTS)
   ↓
8. NCCO Returned with AI Response
   ↓
9. Repeat from step 3 until call ends
```

## Call States

| State | Description |
|-------|-------------|
| `ringing` | Call is ringing |
| `in_progress` | Call is active |
| `completed` | Call ended successfully |
| `failed` | Call failed |
| `cancelled` | Call was cancelled |

## Voice Names

Available TTS voices:
- `Joey` (Male, US English) - Default
- `Joanna` (Female, US English)
- `Matthew` (Male, US English)
- `Emma` (Female, British)
- `Brian` (Male, British)
- `Amy` (Female, British)

## Testing

### Health Check
```bash
curl https://api.botari.ai/api/voice/webhook/health
```

### Test Webhook
```bash
curl -X POST https://api.botari.ai/api/voice/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Generate NCCO
```bash
curl -X POST https://api.botari.ai/api/voice/webhook/ncco \
  -H "Content-Type: application/json" \
  -d '{"action": "talk", "parameters": {"text": "Hello"}}'
```

## Troubleshooting

### Calls Not Connecting
1. Check Vonage credentials in `.env`
2. Verify webhook URLs are publicly accessible
3. Check Vonage application settings
4. Verify phone number is linked to application

### Speech Recognition Not Working
1. Check webhook endpoint is returning valid NCCO
2. Verify `speech` object in NCCO is properly formatted
3. Check Vonage account has Speech recognition enabled

### Webhooks Not Receiving
1. Verify `WEBHOOK_BASE_URL` is correct
2. Ensure server is publicly accessible
3. Check firewall/proxy settings
4. Verify SSL certificate is valid

## Security Considerations

1. **Webhook Authentication**: Vonage webhooks don't include auth tokens by default. Consider adding:
   - IP allowlisting
   - Request signature verification
   - Custom token validation

2. **Private Key**: Keep `VONAGE_PRIVATE_KEY` secure and never commit to git

3. **Phone Numbers**: Validate and sanitize all phone numbers

4. **Recording Access**: Secure recording URLs with proper access controls

## License

MIT License - Botari AI
