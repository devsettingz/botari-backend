# AI Agent Actions System

The Botari AI Agent Actions System enables AI employees to perform actual business operations through function calling with OpenAI.

## Overview

This system transforms AI employees from simple chatbots into functional agents that can:
- Manage inventory and check stock levels
- Book, cancel, and manage appointments
- Take orders and track their status
- Find and update customer information
- Send emails and schedule follow-ups
- Escalate complex issues to humans

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Actions System                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Inventory   │  │ Appointments │  │    Orders    │      │
│  │   Actions    │  │   Actions    │  │   Actions    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Customers   │  │ Communication│  │   Actions    │      │
│  │   Actions    │  │   Actions    │  │   Registry   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              OpenAI Function Calling                 │   │
│  │     (Tools dynamically assigned per employee)        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/agent/
├── index.ts          # Core processing with function calling
├── actions.ts        # All action handler implementations
├── types.ts          # TypeScript type definitions
├── index-export.ts   # Module exports
└── README.md         # This file
```

## Action Categories

### 1. Inventory Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `check_inventory` | Search products and check stock | `product_name`, `product_id`, `category` |
| `update_inventory` | Update stock levels or prices | `product_id`, `quantity_change`, `new_quantity`, `price`, `reason` |
| `check_price` | Get product pricing info | `product_name`, `product_id` |

### 2. Appointment Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `check_availability` | Check available time slots | `date`, `duration_minutes`, `service_type` |
| `book_appointment` | Create new appointment | `customer_phone`, `date`, `time`, `service_name`, `notes` |
| `cancel_appointment` | Cancel existing appointment | `appointment_id`, `reason` |
| `list_appointments` | Show upcoming appointments | `customer_phone`, `date_from`, `date_to`, `status` |

### 3. Order Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `take_order` | Create new order | `customer_phone`, `items[]`, `notes` |
| `check_order_status` | Track order status | `order_id`, `customer_phone` |
| `cancel_order` | Cancel existing order | `order_id`, `reason` |

### 4. Customer Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `find_customer` | Search customers | `phone`, `name` |
| `create_customer` | Add new customer | `phone`, `name`, `email`, `address`, `notes` |
| `update_customer` | Update customer info | `customer_id`, `name`, `email`, `address`, `notes`, `add_tags` |

### 5. Communication Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `send_email` | Queue email to customer | `to_email`, `subject`, `body`, `template` |
| `schedule_followup` | Schedule reminder | `customer_phone`, `scheduled_at`, `notes`, `channel` |
| `escalate_to_human` | Hand off to human | `reason`, `priority` |

## Employee Capabilities

Each AI employee has access to a specific set of actions:

| Employee | Available Actions |
|----------|------------------|
| **Amina** (Sales) | All actions - full access |
| **Stan** (B2B Sales) | Customer, communication, follow-ups |
| **Eva** (Support) | Customer, communication, follow-ups |
| **Rachel** (Voice) | Appointments, customers, follow-ups |
| **Sonny** (Content) | Communication, follow-ups |
| **Penny** (SEO) | Communication, follow-ups |
| **Linda** (Legal) | Communication, follow-ups |

## API Endpoints

### Execute Action
```http
POST /api/agents/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "check_inventory",
  "params": {
    "product_name": "iPhone"
  },
  "businessId": 1,
  "customerPhone": "+2348012345678"
}
```

### Execute Batch Actions
```http
POST /api/agents/execute-batch
Authorization: Bearer <token>

{
  "actions": [
    { "action": "find_customer", "params": { "phone": "+2348012345678" } },
    { "action": "check_order_status", "params": { "customer_phone": "+2348012345678" } }
  ]
}
```

### Get Employee Actions
```http
GET /api/agents/:employeeId/actions
Authorization: Bearer <token>
```

### Process Message (with function calling)
```http
POST /api/agents/process-message
Authorization: Bearer <token>

{
  "message": "Do you have iPhone 15 in stock?",
  "customer_phone": "+2348012345678",
  "employee_type": "amina",
  "platform": "whatsapp"
}
```

### Chat with Tools
```http
POST /api/agents/chat
Authorization: Bearer <token>

{
  "messages": [
    { "role": "user", "content": "Book an appointment for tomorrow at 2pm" }
  ],
  "employee_type": "amina",
  "use_tools": true
}
```

## Function Calling Flow

1. **User sends message** → Agent receives text
2. **Parse intent** → OpenAI analyzes with available tools
3. **Determine actions** → Model decides which functions to call
4. **Execute actions** → Handlers perform database operations
5. **Get results** → Action results returned to model
6. **Generate response** → AI crafts reply using action results
7. **Return to user** → Reply + executed actions sent back

## Example Flow

```
User: "Do you have iPhone 15 in stock and how much is it?"

↓ OpenAI receives with tools

Function Call: check_price({"product_name": "iPhone 15"})

↓ Action executes

Result: {
  "success": true,
  "data": [
    { "name": "iPhone 15 Pro", "price": 999.99, "in_stock": true, "stock_quantity": 15 }
  ]
}

↓ OpenAI generates response

Reply: "Yes! We have the iPhone 15 Pro in stock (15 available) at $999.99. 
Would you like me to place an order for you?"
```

## Database Schema

### Core Tables
- `products` - Product catalog with inventory
- `customers` - Customer database
- `appointments` - Appointment scheduling
- `orders` - Order records with JSONB items
- `inventory_logs` - Audit trail for stock changes

### Support Tables
- `action_logs` - All executed actions
- `email_queue` - Outgoing email queue
- `follow_ups` - Scheduled reminders
- `escalations` - Human escalation queue

### Views
- `low_stock_products` - Products needing restock
- `todays_appointments` - Today's scheduled appointments
- `recent_orders` - Last 30 days orders
- `pending_follow_ups` - Overdue and upcoming follow-ups
- `agent_action_stats` - Action execution statistics

## Usage Example

```typescript
import { processMessage } from './agent';

// Process a customer message
const response = await processMessage(
  "I want to book an appointment for tomorrow at 2pm",
  "+2348012345678",
  "amina",
  { business_id: 1, business_name: "Tech Store" },
  "whatsapp"
);

console.log(response.reply);
// "I've checked availability and can book you for tomorrow at 2:00 PM. 
//  What service do you need?"

console.log(response.actions);
// [{ name: "check_availability", params: {...}, result: {...} }]
```

## Adding New Actions

1. Define the action handler in `actions.ts`:

```typescript
const myNewAction: ActionHandler = {
  name: 'my_action',
  description: 'What this action does',
  parameters: [
    { name: 'param1', type: 'string', required: true, description: '...' }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    // Implementation
    return { success: true, data: result, message: 'Done!' };
  }
};
```

2. Register in `ALL_ACTIONS` array

3. Assign to employees in `EMPLOYEE_ACTIONS`

## Error Handling

All actions return `ActionResult`:

```typescript
{
  success: boolean;
  data?: any;        // Success data
  error?: string;    // Error message
  message?: string;  // Human-readable message
}
```

## Testing

Use the seed data in migration `003_seed_sample_data.sql` for testing:

```sql
-- Check sample products
SELECT * FROM products WHERE business_id = 1;

-- Check sample customers
SELECT * FROM customers WHERE business_id = 1;

-- Test action via API
curl -X POST http://localhost:4000/api/agents/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "check_inventory",
    "params": {"product_name": "iPhone"},
    "businessId": 1
  }'
```

## Security Considerations

- Actions validate `business_id` to prevent cross-tenant access
- All database queries use parameterized statements
- Employee types have restricted action sets
- Sensitive actions log to `action_logs` for audit

## Future Enhancements

- [ ] Multi-step action workflows
- [ ] Action confirmation for high-impact operations
- [ ] Real-time inventory notifications
- [ ] SMS integration for notifications
- [ ] Advanced scheduling with calendar sync
