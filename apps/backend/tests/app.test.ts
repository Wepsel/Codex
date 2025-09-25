import request from "supertest";
import { createApp } from "../src/server";

describe("backend API", () => {
  const app = createApp();
  let authCookie: string | undefined;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin" });

    expect(loginRes.status).toBe(200);
    authCookie = loginRes.headers["set-cookie"]?.[0];
    expect(authCookie).toBeDefined();
  });

  it("should register a new user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "pilot",
        email: "pilot@example.com",
        name: "Control Pilot",
        password: "pilot123"
      });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it("should return current user profile", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie!);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("email", "admin@example.com");
  });

  it("should return health status", async () => {
    const res = await request(app).get("/api/system/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe("healthy");
  });

  it("should block unauthenticated cluster access", async () => {
    const res = await request(app).get("/api/cluster/summary");
    expect(res.status).toBe(401);
  });

  it("should deliver cluster summary when authenticated", async () => {
    const res = await request(app)
      .get("/api/cluster/summary")
      .set("Cookie", authCookie!);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id");
  });

  it("should plan deployment", async () => {
    const res = await request(app)
      .post("/api/cluster/deployments/plan")
      .set("Cookie", authCookie!)
      .send({
        name: "checkout",
        namespace: "production",
        image: "ghcr.io/example/checkout:1.2.3",
        replicas: 3,
        strategy: "RollingUpdate"
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("diff");
  });

  it("should provide compliance summary", async () => {
    const res = await request(app)
      .get("/api/compliance/summary")
      .set("Cookie", authCookie!);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("generatedAt");
    expect(res.body.data.rbac.highRiskRoles.length).toBeGreaterThan(0);
  });

  it("should provide incident war room data", async () => {
    const res = await request(app)
      .get("/api/compliance/war-room")
      .set("Cookie", authCookie!);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("incidentId");
    expect(res.body.data.notes.length).toBeGreaterThan(0);
  });
});
