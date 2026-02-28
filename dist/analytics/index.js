"use strict";
/**
 * Analytics Module - Botari AI
 *
 * Centralized exports for all analytics functionality.
 *
 * Usage:
 *   import { analyticsService, reportGenerator } from './analytics';
 *   import { AnalyticsService, ReportGenerator } from './analytics';
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.reportGenerator = exports.ReportGenerator = exports.analyticsService = exports.AnalyticsService = void 0;
// Core Analytics Service
var AnalyticsService_1 = require("./AnalyticsService");
Object.defineProperty(exports, "AnalyticsService", { enumerable: true, get: function () { return AnalyticsService_1.AnalyticsService; } });
Object.defineProperty(exports, "analyticsService", { enumerable: true, get: function () { return AnalyticsService_1.analyticsService; } });
// Report Generators
var reports_1 = require("./reports");
Object.defineProperty(exports, "ReportGenerator", { enumerable: true, get: function () { return reports_1.ReportGenerator; } });
Object.defineProperty(exports, "reportGenerator", { enumerable: true, get: function () { return reports_1.reportGenerator; } });
// Default exports
var AnalyticsService_2 = require("./AnalyticsService");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(AnalyticsService_2).default; } });
//# sourceMappingURL=index.js.map