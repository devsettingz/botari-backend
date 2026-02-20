# Botari AI Database Migrations

This directory contains all database migrations for the Botari AI platform.

## Migration Files

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Creates all core tables (businesses, ai_employees, conversations, messages, orders, appointments, etc.) |
| `002_add_indexes.sql` | Adds performance indexes for all tables |
| `003_seed_data.sql` | Inserts initial AI employee templates and demo data |
| `004_add_triggers.sql` | Creates database triggers for automatic updates |

## Running Migrations

### Using the Migration Runner

```bash
# Run all pending migrations
node migrate.js up

# Check migration status
node migrate.js status

# Create a new migration
node migrate.js create add_user_preferences
```

### Using psql

```bash
# Run all migrations
psql -U postgres -d botari -f migrations/001_initial_schema.sql
psql -U postgres -d botari -f migrations/002_add_indexes.sql
psql -U postgres -d botari -f migrations/003_seed_data.sql
psql -U postgres -d botari -f migrations/004_add_triggers.sql
```

## Schema Overview

### Core Tables

- **businesses** - Main tenant table for businesses using the platform
- **ai_employees** - Template definitions for AI employee personas
- **business_employees** - Instances of AI employees hired by businesses

### Messaging Tables

- **conversations** - Chat conversations between customers and AI employees
- **messages** - Individual messages within conversations
- **channels** - Multi-channel configuration (WhatsApp, Email, Voice, etc.)
- **whatsapp_sessions** - WhatsApp connection state

### Commerce Tables

- **products** - Product catalog for e-commerce functionality
- **orders** - Customer orders and transactions
- **appointments** - Scheduled appointments and bookings

### Payment Tables

- **payments** - Payment transaction records
- **subscriptions** - Subscription billing management

### Audit Tables

- **action_logs** - Audit log for AI actions and tool calls
- **activity_logs** - General activity tracking
- **error_logs** - System error tracking

### Analytics Tables

- **daily_stats** - Aggregated daily metrics per business
- **customer_analytics** - Per-customer metrics

### Knowledge Base Tables

- **knowledge_base** - FAQ and documentation
- **custom_instructions** - AI behavior customization

## AI Employee Templates

The seed data includes 7 AI employee templates:

| Name | Role | Channel | Tier | Price/Month |
|------|------|---------|------|-------------|
| Amina | AI Receptionist | WhatsApp | Starter | $49 |
| Stan | AI Sales Assistant | WhatsApp | Professional | $79 |
| Lira | AI Appointment Manager | WhatsApp | Professional | $59 |
| Echo | AI Voice Assistant | Voice | Premium | $99 |
| Nova | AI Social Media Manager | Social | Premium | $89 |
| Iris | AI Email Manager | Email | Professional | $69 |
| Atlas | AI Enterprise Assistant | WhatsApp | Enterprise | $299 |

## Environment Variables

The migration runner uses these environment variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=botari
DB_USER=postgres
DB_PASSWORD=postgres
```

## Creating New Migrations

1. Use the migration runner: `node migrate.js create migration_name`
2. Edit the generated file
3. Test locally before committing
4. Run `node migrate.js up` to apply

## Best Practices

- Always wrap migrations in `BEGIN; ... COMMIT;`
- Make migrations idempotent where possible
- Test migrations on a copy of production data
- Never modify existing migration files that have been run in production
- Create new migrations to fix issues
