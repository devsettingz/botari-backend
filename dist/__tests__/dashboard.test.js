"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
describe("Dashboard API (Test Mode)", () => {
    test("returns summary data", async () => {
        const res = await (0, supertest_1.default)(index_1.app).get("/api/dashboard/summary");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("total_messages");
        expect(res.body).toHaveProperty("total_conversations");
        expect(res.body).toHaveProperty("total_subscriptions");
    });
});
//# sourceMappingURL=dashboard.test.js.map