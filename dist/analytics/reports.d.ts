/**
 * Analytics Reports Module
 *
 * Generates comprehensive reports for businesses and platform analytics:
 * - Daily summary reports
 * - Weekly business reports
 * - Monthly platform reports
 */
import { AnalyticsService, TimeSeriesPoint, PlatformMetrics } from './AnalyticsService';
export interface DailyReport {
    date: string;
    businessId?: number;
    summary: {
        totalConversations: number;
        newConversations: number;
        closedConversations: number;
        totalMessages: number;
        avgResponseTime: string;
        revenue: number;
        ordersPlaced: number;
    };
    conversations: Array<{
        id: number;
        customerName: string;
        status: string;
        messageCount: number;
        duration: string;
        employeeName: string;
    }>;
    topProducts: Array<{
        name: string;
        inquiries: number;
    }>;
    employeeActivity: Array<{
        employeeName: string;
        conversations: number;
        messages: number;
        actions: number;
    }>;
    hourlyBreakdown: Array<{
        hour: number;
        conversations: number;
        messages: number;
    }>;
}
export interface WeeklyReport {
    weekStarting: string;
    weekEnding: string;
    businessId?: number;
    summary: {
        totalConversations: number;
        totalMessages: number;
        avgMessagesPerConversation: number;
        conversionRate: number;
        totalRevenue: number;
        newCustomers: number;
        customerSatisfaction: number;
    };
    trends: {
        conversations: TimeSeriesPoint[];
        messages: TimeSeriesPoint[];
        revenue: TimeSeriesPoint[];
    };
    topPerformers: {
        employees: Array<{
            name: string;
            conversations: number;
            conversionRate: number;
            satisfaction: number;
        }>;
        products: Array<{
            name: string;
            orders: number;
            revenue: number;
        }>;
    };
    insights: string[];
    recommendations: string[];
}
export interface MonthlyPlatformReport {
    month: string;
    year: number;
    platformMetrics: PlatformMetrics;
    businessGrowth: {
        newBusinesses: number;
        churnedBusinesses: number;
        growthRate: number;
    };
    revenue: {
        totalRevenue: number;
        mrr: number;
        arr: number;
        revenuePerBusiness: number;
    };
    usage: {
        totalConversations: number;
        totalMessages: number;
        avgConversationsPerBusiness: number;
        peakUsageDay: string;
    };
    topBusinesses: Array<{
        name: string;
        conversations: number;
        revenue: number;
        satisfaction: number;
    }>;
    featureUsage: Array<{
        feature: string;
        usageCount: number;
        growthRate: number;
    }>;
    employeePerformance: Array<{
        employeeType: string;
        totalConversations: number;
        avgHandlingTime: number;
        satisfaction: number;
    }>;
}
export interface BusinessHealthScore {
    businessId: number;
    businessName: string;
    overallScore: number;
    categories: {
        engagement: number;
        responseTime: number;
        conversion: number;
        satisfaction: number;
        growth: number;
    };
    status: 'healthy' | 'needs_attention' | 'critical';
    recommendations: string[];
}
export declare class ReportGenerator {
    private analytics;
    constructor(analytics?: AnalyticsService);
    generateDailyReport(businessId?: number, date?: Date): Promise<DailyReport>;
    generateWeeklyReport(businessId?: number, date?: Date): Promise<WeeklyReport>;
    generateMonthlyPlatformReport(year?: number, month?: number): Promise<MonthlyPlatformReport>;
    generateBusinessHealthScore(businessId: number): Promise<BusinessHealthScore>;
    private getDailyTrend;
    private generateInsights;
    private generateRecommendations;
    private formatDuration;
}
export declare const reportGenerator: ReportGenerator;
export default reportGenerator;
//# sourceMappingURL=reports.d.ts.map