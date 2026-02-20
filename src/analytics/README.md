# Botari AI Analytics System

Comprehensive analytics module for tracking business metrics, employee performance, and platform-wide statistics.

## Features

- **Real-time Metrics**: Track conversations, messages, revenue, and conversions
- **Time-series Data**: Trend analysis with daily/weekly/monthly aggregations
- **Employee Performance**: Individual AI employee analytics
- **Business Health Scores**: Automated scoring and recommendations
- **Export Functionality**: CSV/JSON export for all data types
- **Caching Layer**: In-memory caching for performance optimization

## API Endpoints

### Dashboard Routes (`/api/dashboard`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Overall dashboard statistics |
| GET | `/conversations` | Conversation metrics |
| GET | `/employees` | Employee performance metrics |
| GET | `/revenue` | Revenue analytics |
| GET | `/:business_id/trends/messages/weekly` | Weekly message trends |
| GET | `/:business_id/trends/conversations/weekly` | Weekly conversation trends |
| GET | `/:business_id/summary` | Business summary |
| GET | `/:business_id/trends/active-users/weekly` | Active users trend |
| GET | `/:business_id/trends/revenue/weekly` | Revenue trend |

### Analytics Routes (`/api/analytics`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/overview` | Platform overview | Admin only |
| GET | `/businesses` | Business growth metrics | All |
| GET | `/businesses/:id` | Single business analytics | Owner/Admin |
| GET | `/conversations` | Conversation trends | All |
| GET | `/conversations/trends` | Time-series conversation data | All |
| GET | `/employees` | All employees metrics | All |
| GET | `/employees/:id` | Single employee stats | All |
| GET | `/export` | Export data (CSV/JSON) | All |
| GET | `/reports/daily` | Daily report | All |
| GET | `/reports/weekly` | Weekly report | All |
| GET | `/reports/monthly` | Monthly platform report | Admin only |
| POST | `/cache/clear` | Clear analytics cache | Admin only |
| GET | `/cache/stats` | Cache statistics | Admin only |

## Query Parameters

### Date Range Filtering
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)

### Pagination & Limits
- `limit` - Maximum number of results
- `days` - Number of days for trend data (default: 30)

### Export Options
- `type` - Data type: `conversations`, `messages`, `orders`, `employees`, `revenue`
- `format` - Export format: `csv` or `json`
- `businessId` - Filter by specific business

## Response Format

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalConversations": 15420,
      "totalMessages": 89300,
      "avgResponseTime": "2.3s",
      "activeBusinesses": 145,
      "totalRevenue": 150000,
      "conversionRate": 12.5
    },
    "trends": {
      "conversations": [
        {"date": "2024-01-01", "count": 450},
        {"date": "2024-01-02", "count": 520}
      ]
    }
  }
}
```

## Metrics Tracked

### Business Metrics
- Total conversations (daily/weekly/monthly)
- Messages per conversation
- Average response time
- Peak hours
- Top products inquired about
- Conversion rate (inquiry → order)
- Customer satisfaction (from feedback)
- Revenue generated

### Employee Metrics
- Messages handled
- Actions executed
- Success rate of actions
- Average handling time
- Escalation rate
- Revenue generated
- Customer satisfaction

### Platform Metrics (Admin)
- Total businesses
- Active businesses
- Revenue (MRR/ARR)
- Churn rate
- Employee utilization
- Conversation volume
- Popular features

## Database Views

The analytics system uses optimized PostgreSQL views:

- `business_daily_stats` - Daily aggregated statistics
- `employee_performance` - Employee performance metrics
- `revenue_metrics` - Monthly revenue breakdown
- `conversation_hourly_stats` - Hourly conversation patterns
- `product_inquiry_stats` - Product inquiry tracking
- `customer_activity_stats` - Customer engagement metrics
- `platform_overview` - High-level platform metrics

## Caching

Analytics data is cached for 5 minutes by default to improve performance:
- Cache key format: `{prefix}:{params_hash}`
- Manual cache invalidation via `POST /analytics/cache/clear`
- Cache statistics via `GET /analytics/cache/stats`

## Usage Example

```typescript
import { analyticsService, reportGenerator } from './analytics';

// Get business metrics
const metrics = await analyticsService.getBusinessMetrics(1, {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});

// Generate daily report
const report = await reportGenerator.generateDailyReport(1);

// Export data
const csv = await analyticsService.exportData(
  'conversations',
  'csv',
  1,
  { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-31') }
);
```

## File Structure

```
src/analytics/
├── AnalyticsService.ts    # Core analytics engine
├── reports.ts             # Report generators
├── index.ts               # Module exports
└── README.md              # Documentation
```
