"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
describe("Auth API (Test Mode)", () => {
    test("login returns token with valid credentials", async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post("/api/auth/login") // matches your route prefix
            .send({ email: "testuser@example.com", password: "secret" });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });
    test("login fails with invalid credentials", async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post("/api/auth/login")
            .send({ email: "wrong@example.com", password: "bad" });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid credentials");
    });
});
//# sourceMappingURL=auth.test.js.map