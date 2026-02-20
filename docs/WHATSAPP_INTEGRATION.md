# WhatsApp Baileys Integration for Botari AI

Complete WhatsApp Web integration using `@adiwajshing/baileys` library with multi-business support, session persistence, and AI agent integration.

## Features

- ✅ **Multi-business support** - Each business has its own WhatsApp session
- ✅ **QR Code generation** - Easy pairing via WhatsApp Web
- ✅ **Session persistence** - Credentials stored in PostgreSQL, auto-restore on restart
- ✅ **Auto-reconnection** - Handles disconnections gracefully
- ✅ **Message history** - All messages stored in database
- ✅ **AI integration** - Incoming messages automatically processed by AI agent
- ✅ **Broadcast messaging** - Send messages to multiple recipients
- ✅ **Webhook support** - Handle external WhatsApp providers

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client App    │────▶│   API Routes     │────▶│ WhatsAppManager │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │                           │
                              ▼                           ▼
                        ┌──────────┐              ┌──────────────┐
                        │  PostgreSQL│            │  @adiwajshing/baileys │
                        │  (sessions)│            │  (WhatsApp Web)       │
                        └──────────┘              └──────────────┘
                                                           │
                                                           ▼
                                                   ┌──────────────┐
                                                   │  WhatsApp    │
                                                   │  Servers     │
                                                   └──────────────┘
```

## API Endpoints

### Connection Management

#### Start Connection
```http
POST /api/whatsapp/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "employee_id": 1
}

Response:
{
  "success": true,
  "status": "awaiting_qr",
  "qrCode": "data:image/png;base64,...",
  "sessionId": "1_1",
  "expiresAt": "2026-02-19T10:01:33.450Z",
  "message": "Scan this QR code with WhatsApp"
}
```

#### Check Status
```http
GET /api/whatsapp/status?employee_id=1
Authorization: Bearer <token>

Response:
{
  "success": true,
  "connected": true,
  "status": "connected",
  "phoneNumber": "+1234567890",
  "lastActivity": "2026-02-19T09:01:33.450Z",
  "connectedAt": "2026-02-19T08:30:00.000Z",
  "employees": [...],
  "message": "WhatsApp connected and active"
}
```

#### Get QR Code
```http
GET /api/whatsapp/qr?employee_id=1
Authorization: Bearer <token>

Response:
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "status": "awaiting_qr"
}
```

#### Disconnect
```http
POST /api/whatsapp/disconnect
Authorization: Bearer <token>
Content-Type: application/json

{
  "employee_id": 1,
  "logout": false  // Set to true to clear credentials
}
```

### Messaging

#### Send Message
```http
POST /api/whatsapp/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "+1234567890",
  "message": "Hello from Botari AI!",
  "employee_id": 1
}
```

#### Broadcast Message
```http
POST /api/whatsapp/broadcast
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipients": ["+1234567890", "+0987654321"],
  "message": "Hello everyone!",
  "delay_ms": 1000
}
```

### Sessions

#### Get All Sessions
```http
GET /api/whatsapp/sessions
Authorization: Bearer <token>

Response:
{
  "success": true,
  "sessions": [...],
  "count": 2
}
```

## Webhook Endpoints

### Standard Webhook
```http
POST /api/webhook/whatsapp
Content-Type: application/json

{
  "From": "whatsapp:+1234567890",
  "Body": "Hello",
  "BusinessId": "1"
}
```

### Incoming Message Handler
```http
POST /api/webhook/whatsapp/incoming
Content-Type: application/json

{
  "phone": "+1234567890",
  "message": "Hello",
  "business_id": "1"
}
```

### Status Updates
```http
POST /api/webhook/whatsapp/status
Content-Type: application/json

{
  "MessageSid": "...",
  "MessageStatus": "delivered",
  "To": "+1234567890"
}
```

## Database Schema

### whatsapp_sessions Table
```sql
CREATE TABLE whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    employee_id INTEGER NOT NULL REFERENCES ai_employees(id),
    status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
    phone_number VARCHAR(20),
    credentials JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_business_employee_session UNIQUE (business_id, employee_id)
);
```

### whatsapp_messages Table
```sql
CREATE TABLE whatsapp_messages (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    sender VARCHAR(50) NOT NULL,
    recipient VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    direction VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'sent',
    whatsapp_message_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment Variables

```bash
# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Secret (required)
JWT_SECRET=your-jwt-secret

# OpenAI (required for AI responses)
OPENAI_API_KEY=sk-...

# WhatsApp Session Path (optional)
WHATSAPP_SESSION_PATH=./whatsapp-sessions

# Node Environment
NODE_ENV=development
```

## Connection Status Flow

```
disconnected → connecting → awaiting_qr → connected
                                    ↓
                              reconnected (auto)
```

1. **disconnected** - Initial state, no connection
2. **connecting** - Starting Baileys connection
3. **awaiting_qr** - QR code generated, waiting for scan
4. **connected** - Successfully connected to WhatsApp
5. **reconnecting** - Auto-reconnect after disconnect

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `WhatsApp not connected` | Session not established | Call `/connect` endpoint first |
| `Already connected` | Duplicate connection attempt | Check status with `/status` |
| `Invalid phone number` | Wrong format | Use international format: `+1234567890` |
| `Max reconnection attempts` | Persistent connection failure | Manually reconnect or check credentials |

### Auto-Reconnection

The manager automatically attempts to reconnect on disconnect (up to 5 attempts):
- First attempt: 5 seconds
- Second attempt: 10 seconds
- Third attempt: 15 seconds
- ...etc

If all attempts fail, manual reconnection is required.

## Usage Example

```typescript
import { whatsappManager } from './connectors/whatsapp';

// Start connection and get QR code
const qr = await whatsappManager.connect(businessId, employeeId);
// Display qr.qrCode to user

// Check status
const status = whatsappManager.getStatus(businessId, employeeId);
console.log(status.connected); // true/false

// Send message
await whatsappManager.sendMessage(
  businessId,
  '+1234567890',
  'Hello from Botari AI!'
);

// Disconnect
await whatsappManager.disconnect(businessId, employeeId);
```

## Security Considerations

1. **Session Credentials** - Stored in database as JSONB, ensure database is secured
2. **JWT Authentication** - All routes require valid JWT token
3. **Rate Limiting** - Implement rate limiting for `/send` and `/broadcast` endpoints
4. **Session Files** - Stored in `WHATSAPP_SESSION_PATH`, ensure directory permissions are restricted
5. **QR Code Expiry** - QR codes expire after 60 seconds, generate new one if needed

## Troubleshooting

### WhatsApp Not Connecting
1. Check if `business_employees` record exists
2. Verify database connection
3. Check logs for Baileys errors
4. Delete session folder and reconnect

### Messages Not Sending
1. Verify status is `connected`
2. Check phone number format (international)
3. Ensure recipient is in contacts (for new numbers)
4. Check rate limits

### Session Not Restoring
1. Check if `whatsapp_sessions` table exists
2. Verify credentials were saved
3. Check session folder permissions
4. Review database logs

## Migration

Run the migration to add required tables:

```bash
psql $DATABASE_URL -f botari-api/migrations/001_add_whatsapp_sessions.sql
```

## Development

### Testing Connection

```bash
# Start development server
npm run dev

# In another terminal, test connection
curl -X POST http://localhost:4000/api/whatsapp/connect \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1}'
```

### Logs

Watch for these log patterns:
```
📱 QR Code generated for business 1
✅ WhatsApp connected for business 1 (+1234567890)
❌ WhatsApp disconnected for business 1
🔄 Auto-reconnecting (attempt 1)...
📩 WhatsApp from 1234567890 (Business 1): Hello...
✅ Message sent to 1234567890@s.whatsapp.net for business 1
```

## License

MIT - Same as Botari AI project
