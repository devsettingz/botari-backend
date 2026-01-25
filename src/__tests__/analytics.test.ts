import request from "supertest";
import { app } from "../index";

describe("Dashboard API (Test Mode)", () => {
  test("returns summary data", async () => {
    const res = await request(app).get("/api/dashboard/summary"); // 👈 corrected path

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total_messages");
    expect(res.body).toHaveProperty("total_conversations");
    expect(res.body).toHaveProperty("total_subscriptions");
  });
});
