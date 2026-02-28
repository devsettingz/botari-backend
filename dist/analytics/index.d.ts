/**
 * Analytics Module - Botari AI
 *
 * Centralized exports for all analytics functionality.
 *
 * Usage:
 *   import { analyticsService, reportGenerator } from './analytics';
 *   import { AnalyticsService, ReportGenerator } from './analytics';
 */
export { AnalyticsService, analyticsService, type TimeSeriesPoint, type OverviewMetrics, type BusinessMetrics, type EmployeeMetrics, type PlatformMetrics, type RevenueMetrics, type ConversationMetrics, type DateRange } from './AnalyticsService';
export { ReportGenerator, reportGenerator, type DailyReport, type WeeklyReport, type MonthlyPlatformReport, type BusinessHealthScore } from './reports';
export { default } from './AnalyticsService';
//# sourceMappingURL=index.d.ts.map