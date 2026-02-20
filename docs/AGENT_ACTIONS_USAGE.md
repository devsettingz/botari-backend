# AI Agent Actions - Usage Guide

## Quick Start

### 1. Setup Database

Run the migrations to create the required tables:

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL < migrations/002_agent_actions_system.sql

# Optional: Seed sample data for testing
psql $DATABASE_URL < migrations/003_seed_sample_data.sql
```

### 2. Process Customer Message with Actions

```typescript
import { processMessage } from './agent';

// Amina handles a customer inquiry about products
const response = await processMessage(
  "Do you have iPhone 15 in stock?",
  "+2348012345678",  // customer phone
  "amina",             // employee type
  { 
    business_id: 1, 
    business_name: "Tech Store Lagos" 
  },
  "whatsapp"
);

console.log(response.reply);
// "Yes! We have the iPhone 15 Pro in stock (15 available) at $999.99. 
//  Would you like me to place an order for you?"

console.log(response.actions);
// [{ 
//   name: "check_inventory", 
//   params: { product_name: "iPhone 15" },
//   result: { success: true, data: [...] },
//   timestamp: "2024-02-19T10:30:00Z"
// }]
```

### 3. Execute Actions Directly via API

```bash
# Check inventory
curl -X POST http://localhost:4000/api/agents/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "check_inventory",
    "params": { "product_name": "iPhone" },
    "businessId": 1
  }'

# Response:
# {
#   "success": true,
#   "action": "check_inventory",
#   "result": {
#     "success": true,
#     "data": [
#       { "id": 1, "name": "iPhone 15 Pro", "price": 999.99, "stock_quantity": 15 }
#     ],
#     "message": "Found 1 product(s)"
#   }
# }
```

### 4. Book an Appointment

```bash
curl -X POST http://localhost:4000/api/agents/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "book_appointment",
    "params": {
      "customer_phone": "+2348012345678",
      "date": "2024-02-21",
      "time": "14:00",
      "service_name": "Product Demo",
      "notes": "Interested in iPhone 15 Pro"
    },
    "businessId": 1
  }'
```

### 5. Take an Order

```bash
curl -X POST http://localhost:4000/api/agents/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "take_order",
    "params": {
      "customer_phone": "+2348012345678",
      "items": [
        { "product_id": 1, "quantity": 1 },
        { "product_id": 3, "quantity": 1 }
      ],
      "notes": "Gift wrapping please"
    },
    "businessId": 1
  }'
```

## Available Actions by Category

### Inventory
- `check_inventory` - Search products, check stock
- `update_inventory` - Update stock levels, prices
- `check_price` - Get pricing information

### Appointments
- `check_availability` - Check available time slots
- `book_appointment` - Create new appointment
- `cancel_appointment` - Cancel existing appointment
- `list_appointments` - List upcoming appointments

### Orders
- `take_order` - Create new order
- `check_order_status` - Track order status
- `cancel_order` - Cancel order

### Customers
- `find_customer` - Search customers
- `create_customer` - Add new customer
- `update_customer` - Update customer info

### Communication
- `send_email` - Queue email to customer
- `schedule_followup` - Schedule reminder
- `escalate_to_human` - Hand off to human agent

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/execute` | POST | Execute a single action |
| `/api/agents/execute-batch` | POST | Execute multiple actions |
| `/api/agents/:employeeId/actions` | GET | Get employee's available actions |
| `/api/agents/actions` | GET | Get all actions |
| `/api/agents/process-message` | POST | Process message with AI + actions |
| `/api/agents/chat` | POST | Interactive chat with tool support |
| `/api/agents/:employeeType/stats` | GET | Get agent statistics |
| `/api/agents/all-status` | GET | Get all agent statuses |

## Employee-Specific Actions

| Employee | Actions Available |
|----------|------------------|
| **Amina** | All actions (full sales capabilities) |
| **Stan** | Customer, communication, follow-ups |
| **Eva** | Customer, communication, follow-ups |
| **Rachel** | Appointments, customers, follow-ups |
| **Sonny** | Communication, follow-ups |
| **Penny** | Communication, follow-ups |
| **Linda** | Communication, follow-ups |

## Database Views for Monitoring

```sql
-- Check low stock products
SELECT * FROM low_stock_products WHERE business_id = 1;

-- Today's appointments
SELECT * FROM todays_appointments WHERE business_id = 1;

-- Recent orders
SELECT * FROM recent_orders WHERE business_id = 1;

-- Pending follow-ups
SELECT * FROM pending_follow_ups WHERE business_id = 1;

-- Action statistics
SELECT * FROM agent_action_stats WHERE business_id = 1;
```

## Testing with Sample Data

The seed data creates:
- 10 products (phones, laptops, accessories)
- 5 customers with different profiles
- 5 appointments (confirmed, completed, cancelled)
- 5 orders (delivered, shipped, processing, pending)
- 4 follow-ups (pending and completed)
- 2 escalations

Use these for testing your integrations!

## Error Handling

All actions return a consistent result format:

```typescript
{
  success: boolean;
  data?: any;        // Success data
  error?: string;    // Error message if failed
  message?: string;  // Human-readable message
}
```

Example error response:
```json
{
  "success": false,
  "error": "Insufficient stock for iPhone 15 Pro. Available: 5",
  "message": "Failed to create order"
}
```

## Adding Custom Actions

1. Define in `src/agent/actions.ts`:

```typescript
const myCustomAction: ActionHandler = {
  name: 'my_action',
  description: 'What this action does',
  parameters: [
    { name: 'param1', type: 'string', required: true, description: '...' }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    // Your implementation
    return { success: true, data: result, message: 'Done!' };
  }
};
```

2. Add to `ALL_ACTIONS` array
3. Assign to employees in `EMPLOYEE_ACTIONS`
4. Restart the server

## Security Notes

- All actions validate `business_id` to prevent cross-tenant access
- Actions are logged to `action_logs` table for audit
- Employees can only execute their assigned actions
- Sensitive operations (orders, cancellations) should include confirmation
