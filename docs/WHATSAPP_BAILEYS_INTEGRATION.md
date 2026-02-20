# WhatsApp Baileys Integration

This document describes the WhatsApp integration using the Baileys library for Botari AI.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client App    │────▶│  WhatsApp Routes │────▶│ BaileysManager  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                           ┌──────────────────────────────┼──────────────┐
                           │                              │              │
                    ┌──────▼──────┐              ┌────────▼────────┐     │
                    │ PostgreSQL  │              │  @adiwajshing   │     │
                    │  Session    │              │    /baileys     │     │
                    │   Store     │              │                 │     │
                    └─────────────┘              └────────┬────────┘     │
                                                          │              │
                           ┌──────────────────────────────┘              │
                           │                                             │
                    ┌──────▼──────┐                              ┌───────▼────┐
                    │  WhatsApp   │◀─────────────────────────────│  WhatsApp  │
                    │   Servers   │                              │   Users    │
                    └─────────────┘                              └────────────┘
```

## Components

### 1. BaileysManager (`src/whatsapp/BaileysManager.ts`)

The main class managing WhatsApp connections:

- **Multi-session support**: Each business gets its own isolated WhatsApp session
- **QR Code generation**: Real-time QR codes for WhatsApp Web pairing
- **Connection management**: Handles connect, disconnect, reconnect
- **Message handling**: Routes incoming messages to AI agent
- **Auto-reconnection**: Automatically reconnects on connection loss

Key methods:
```typescript
connect(businessId, employeeId)     // Start connection, returns QR code
disconnect(businessId, employeeId)  // Disconnect session
sendMessage(businessId, to, text)   // Send WhatsApp message
getStatus(businessId, employeeId)   // Get connection status
getAllSessions()                    // List all active sessions
```

### 2. SessionStore (`src/whatsapp/sessionStore.ts`)

PostgreSQL-based session persistence:

- **Credentials storage**: Encrypts and stores Baileys auth credentials
- **Signal keys**: Stores E2E encryption keys
- **Session restoration**: Restores sessions on server restart

Database tables:
- `whatsapp_sessions` - Main session data
- `whatsapp_signal_keys` - E2E encryption keys

### 3. Routes

#### WhatsApp Routes (`src/routes/whatsapp.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/connect` | POST | Start connection, get QR code |
| `/api/whatsapp/disconnect` | POST | Disconnect session |
| `/api/whatsapp/status` | GET | Get connection status |
| `/api/whatsapp/qr` | GET | Get current QR code |
| `/api/whatsapp/send` | POST | Send a message |
| `/api/whatsapp/broadcast` | POST | Send to multiple recipients |
| `/api/whatsapp/sessions` | GET | List all sessions |
| `/api/whatsapp/reconnect` | POST | Force reconnect |

#### Webhook Routes (`src/routes/whatsapp-webhook.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook/whatsapp` | POST | Main webhook for incoming messages |
| `/api/webhook/whatsapp/incoming` | POST | Direct incoming message endpoint |
| `/api/webhook/whatsapp/status` | POST | Message status updates |
| `/api/webhook/whatsapp/health` | GET | Health check |

## Message Flow

### Incoming Message

```
1. WhatsApp User sends message
        ↓
2. Baileys library receives message
        ↓
3. BaileysManager.handleIncomingMessage()
   - Extracts text
   - Saves to whatsapp_messages table
        ↓
4. routeMessage(text, phone, 'whatsapp', businessId)
   - Finds assigned AI employee
   - Processes through OpenAI
   - Returns AI response
        ↓
5. baileysManager.sendMessage()
   - Sends reply back to user
   - Saves outgoing message
```

### Outgoing Message (Business-initiated)

```
1. Business calls POST /api/whatsapp/send
        ↓
2. Route validates and calls baileysManager.sendMessage()
        ↓
3. Message sent via WhatsApp servers
        ↓
4. Message saved to database
```

## Database Schema

### whatsapp_sessions
```sql
CREATE TABLE whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    status VARCHAR(50),          -- disconnected, connecting, awaiting_qr, connected
    phone_number VARCHAR(20),    -- WhatsApp phone number
    credentials JSONB,           -- Baileys auth credentials
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(business_id, employee_id)
);
```

### whatsapp_signal_keys
```sql
CREATE TABLE whatsapp_signal_keys (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    key_type VARCHAR(50),        -- app-state-sync-key, sender-key, etc.
    key_id VARCHAR(255),
    key_data JSONB,              -- Encrypted key data
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(business_id, employee_id, key_type, key_id)
);
```

### whatsapp_messages
```sql
CREATE TABLE whatsapp_messages (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL,
    sender VARCHAR(50),          -- From phone number
    recipient VARCHAR(50),       -- To phone number
    content TEXT,
    message_type VARCHAR(20),    -- text, image, audio, etc.
    direction VARCHAR(10),       -- incoming, outgoing
    status VARCHAR(20),          -- pending, sent, delivered, read, failed
    created_at TIMESTAMP
);
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# OpenAI (for AI responses)
OPENAI_API_KEY=sk-...

# Server
PORT=4000
NODE_ENV=development
```

## Usage Examples

### Connect WhatsApp

```bash
curl -X POST https://api.botari.ai/api/whatsapp/connect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1}'

Response:
{
  "success": true,
  "status": "awaiting_qr",
  "qrCode": "data:image/png;base64,...",
  "sessionId": "1_1",
  "expiresAt": "2024-01-15T10:30:00.000Z",
  "message": "Scan this QR code with WhatsApp"
}
```

### Check Status

```bash
curl https://api.botari.ai/api/whatsapp/status \
  -H "Authorization: Bearer <token>"

Response:
{
  "success": true,
  "connected": true,
  "status": "connected",
  "phoneNumber": "1234567890",
  "lastActivity": "2024-01-15T10:25:00.000Z",
  "connectedAt": "2024-01-15T10:20:00.000Z",
  "employees": [...]
}
```

### Send Message

```bash
curl -X POST https://api.botari.ai/api/whatsapp/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Hello from Botari!"
  }'
```

## Error Handling

The integration handles various error scenarios:

| Error | Handling |
|-------|----------|
| Connection lost | Auto-reconnect with exponential backoff (max 5 attempts) |
| QR expired | Auto-clear after 60 seconds, requires new connect call |
| Message failed | Error returned to caller, status logged |
| AI error | Error message sent to user: "Sorry, I'm having technical difficulties..." |
| Invalid phone | 400 error with validation message |

## Security Considerations

1. **Credentials**: Stored encrypted in PostgreSQL, never logged
2. **Phone numbers**: Validated with regex before sending
3. **Session isolation**: Each business has isolated sessions
4. **Rate limiting**: Broadcast messages include delays to avoid spam detection

## Troubleshooting

### QR Code not scanning
- QR expires after 60 seconds - generate a new one
- Ensure phone has internet connection
- Try logging out and reconnecting

### Messages not sending
- Check status endpoint - session may be disconnected
- Verify phone number format (E.164: +1234567890)
- Check logs for rate limiting

### Connection drops frequently
- Check network stability
- Review `maxReconnectAttempts` setting (default: 5)
- Check WhatsApp Web session limits on phone

### Session not restoring
- Verify `whatsapp_sessions` table has credentials
- Check `whatsapp_signal_keys` table exists
- Review server logs for PostgreSQL errors

## Development

### Running locally

```bash
cd botari-api
npm install
npm run dev
```

### Testing WhatsApp integration

1. Create a business and employee
2. Call `/api/whatsapp/connect` to get QR
3. Scan QR with WhatsApp (Settings > Linked Devices)
4. Send a message to the connected number
5. AI should respond automatically

### Logs

Look for these log prefixes:
- `[BaileysManager]` - Main manager operations
- `[SessionStore]` - Database operations
- `[WhatsApp API]` - Route handlers
- `[WhatsApp Webhook]` - Webhook handlers
