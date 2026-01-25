import request from "supertest";
import { app } from "../index";

describe("Auth API (Test Mode)", () => {
  test("login returns token with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login") // matches your route prefix
      .send({ email: "testuser@example.com", password: "secret" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("login fails with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrong@example.com", password: "bad" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });
});
