/**
 * Analytics Module - Botari AI
 * 
 * Centralized exports for all analytics functionality.
 * 
 * Usage:
 *   import { analyticsService, reportGenerator } from './analytics';
 *   import { AnalyticsService, ReportGenerator } from './analytics';
 */

// Core Analytics Service
export { 
  AnalyticsService, 
  analyticsService,
  // Types
  type TimeSeriesPoint,
  type OverviewMetrics,
  type BusinessMetrics,
  type EmployeeMetrics,
  type PlatformMetrics,
  type RevenueMetrics,
  type ConversationMetrics,
  type DateRange
} from './AnalyticsService';

// Report Generators
export { 
  ReportGenerator, 
  reportGenerator,
  // Types
  type DailyReport,
  type WeeklyReport,
  type MonthlyPlatformReport,
  type BusinessHealthScore
} from './reports';

// Default exports
export { default } from './AnalyticsService';
