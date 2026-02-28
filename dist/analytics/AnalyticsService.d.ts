/**
 * Analytics Service - Core analytics engine for Botari AI
 *
 * This service provides comprehensive analytics capabilities including:
 * - Metric calculations from database
 * - Time-series data generation
 * - Statistics aggregation
 * - Caching for performance optimization
 */
export interface TimeSeriesPoint {
    date: string;
    count: number;
}
export interface OverviewMetrics {
    totalConversations: number;
    totalMessages: number;
    avgResponseTime: string;
    activeBusinesses: number;
    totalRevenue: number;
    conversionRate: number;
}
export interface BusinessMetrics {
    businessId: number;
    businessName: string;
    totalConversations: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
    avgResponseTime: number;
    peakHour: string;
    conversionRate: number;
    customerSatisfaction: number;
    revenueGenerated: number;
    topProducts: Array<{
        name: string;
        inquiries: number;
    }>;
    trends: {
        conversations: TimeSeriesPoint[];
        messages: TimeSeriesPoint[];
    };
}
export interface EmployeeMetrics {
    employeeId: number;
    displayName: string;
    employeeRole: string;
    messagesHandled: number;
    conversationsHandled: number;
    actionsExecuted: number;
    actionsSuccessRate: number;
    avgHandlingTime: number;
    escalationRate: number;
    revenueGenerated: number;
    customerSatisfaction: number;
    trend: TimeSeriesPoint[];
}
export interface PlatformMetrics {
    totalBusinesses: number;
    activeBusinesses: number;
    totalEmployees: number;
    activeEmployees: number;
    mrr: number;
    arr: number;
    churnRate: number;
    employeeUtilization: number;
    totalConversations: number;
    totalMessages: number;
    popularFeatures: Array<{
        feature: string;
        usage: number;
    }>;
    businessGrowth: TimeSeriesPoint[];
    revenueGrowth: TimeSeriesPoint[];
}
export interface RevenueMetrics {
    totalRevenue: number;
    monthlyRecurringRevenue: number;
    averageRevenuePerUser: number;
    revenueByMonth: TimeSeriesPoint[];
    revenueByPlan: Array<{
        plan: string;
        revenue: number;
        businesses: number;
    }>;
    paymentSuccessRate: number;
}
export interface ConversationMetrics {
    totalConversations: number;
    totalMessages: number;
    openConversations: number;
    closedConversations: number;
    escalatedConversations: number;
    avgConversationDuration: number;
    avgMessagesPerConversation: number;
    conversationsByHour: Array<{
        hour: number;
        count: number;
    }>;
    conversationsByDay: Array<{
        day: string;
        count: number;
    }>;
    topTopics: Array<{
        topic: string;
        count: number;
    }>;
}
export interface DateRange {
    startDate?: Date;
    endDate?: Date;
}
export declare class AnalyticsService {
    private cache;
    private readonly CACHE_TTL;
    private getCacheKey;
    private getCached;
    private setCache;
    private invalidateCache;
    getOverviewMetrics(businessId?: number): Promise<OverviewMetrics>;
    getBusinessMetrics(businessId: number, dateRange?: DateRange): Promise<BusinessMetrics>;
    private getBusinessTrends;
    getEmployeeMetrics(employeeId: number, businessId?: number, dateRange?: DateRange): Promise<EmployeeMetrics>;
    private getEmployeeTrend;
    getAllEmployeesMetrics(businessId?: number, dateRange?: DateRange): Promise<EmployeeMetrics[]>;
    getPlatformMetrics(dateRange?: DateRange): Promise<PlatformMetrics>;
    private getBusinessGrowthTrend;
    private getRevenueGrowthTrend;
    getRevenueMetrics(businessId?: number, dateRange?: DateRange): Promise<RevenueMetrics>;
    getConversationMetrics(businessId?: number, dateRange?: DateRange): Promise<ConversationMetrics>;
    exportData(type: 'conversations' | 'messages' | 'orders' | 'employees' | 'revenue', format: 'csv' | 'json', businessId?: number, dateRange?: DateRange): Promise<string>;
    private buildDateFilter;
    private getDaysFromRange;
    private fillDateGaps;
    private formatDuration;
    clearCache(): void;
    getCacheStats(): {
        size: number;
        keys: string[];
    };
}
export declare const analyticsService: AnalyticsService;
export default analyticsService;
//# sourceMappingURL=AnalyticsService.d.ts.map