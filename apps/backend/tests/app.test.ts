import request from "supertest";
import { createApp } from "../src/server";

describe("backend API", () => {
  const app = createApp();
  let authCookie: string | undefined;
  let adminCompanyId: string | undefined;
  let createdMemberId: string | undefined;
  let createdClusterId: string | undefined;
  let viewerCookie: string | undefined;

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
        password: "pilot123",
        company: { mode: "create", name: "Pilot Ops" }
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.company).toMatchObject({
      name: "Pilot Ops",
      role: "admin",
      status: "active"
    });
  });

  it("should expose company admin overview", async () => {
    const res = await request(app)
      .get("/api/auth/company/admin")
      .set("Cookie", authCookie!);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.profile).toHaveProperty("id");
    expect(Array.isArray(res.body.data.members)).toBe(true);
    adminCompanyId = res.body.data.profile.id;
  });

  it("should manage member lifecycle", async () => {
    expect(adminCompanyId).toBeDefined();

    const joinRes = await request(app)
      .post("/api/auth/register")
      .send({
        username: "crew",
        email: "crew@example.com",
        name: "Flight Crew",
        password: "crew123",
        company: { mode: "join", companyId: adminCompanyId! }
      });

    expect(joinRes.status).toBe(201);
    const pendingRequestId: string | undefined = joinRes.body.data.company.pendingRequestId;
    createdMemberId = joinRes.body.data.id;
    expect(pendingRequestId).toBeDefined();
    expect(joinRes.body.data.company.status).toBe("pending");

    const approveRes = await request(app)
      .post("/api/auth/company/requests/" + pendingRequestId + "/decision")
      .set("Cookie", authCookie!)
      .send({ decision: "approve" });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe("approved");

    const promoteRes = await request(app)
      .patch("/api/auth/company/members/" + createdMemberId)
      .set("Cookie", authCookie!)
      .send({ role: "admin" });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.data.role).toBe("admin");

    const resetRes = await request(app)
      .post("/api/auth/company/members/" + createdMemberId + "/reset-password")
      .set("Cookie", authCookie!)
      .send();

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.userId).toBe(createdMemberId);
    expect(typeof resetRes.body.data.temporaryPassword).toBe("string");
    expect(resetRes.body.data.temporaryPassword.length).toBeGreaterThanOrEqual(8);

    const removeRes = await request(app)
      .delete("/api/auth/company/members/" + createdMemberId)
      .set("Cookie", authCookie!)
      .send();

    expect(removeRes.status).toBe(204);

    const overview = await request(app)
      .get("/api/auth/company/admin")
      .set("Cookie", authCookie!);

    expect(overview.status).toBe(200);
    const memberIds: string[] = overview.body.data.members.map((member: { id: string }) => member.id);
    expect(memberIds).not.toContain(createdMemberId);
  });

  it("should share clusters across company members and enforce roles", async () => {
    expect(adminCompanyId).toBeDefined();

    const clusterPayload = {
      name: "Shared Cluster",
      apiUrl: "https://cluster.example.com",
      insecureTLS: true,
      auth: { bearerToken: "fake-token" }
    };

    const createClusterRes = await request(app)
      .post("/api/clusters")
      .set("Cookie", authCookie!)
      .send(clusterPayload);

    expect(createClusterRes.status).toBe(201);
    createdClusterId = createClusterRes.body.data.id;
    expect(createdClusterId).toBeDefined();

    const adminListRes = await request(app)
      .get("/api/clusters")
      .set("Cookie", authCookie!);
    expect(adminListRes.status).toBe(200);
    expect(adminListRes.body.data.some((cluster: { id: string }) => cluster.id === createdClusterId)).toBe(true);

    const viewerRegister = await request(app)
      .post("/api/auth/register")
      .send({
        username: "viewer",
        email: "viewer@example.com",
        name: "Company Viewer",
        password: "viewer123",
        company: { mode: "join", companyId: adminCompanyId! }
      });


    expect(viewerRegister.status).toBe(201);
    viewerCookie = viewerRegister.headers["set-cookie"]?.[0];
    const viewerPendingRequestId: string | undefined = viewerRegister.body.data.company.pendingRequestId;
    expect(viewerPendingRequestId).toBeDefined();

    const approveViewerRes = await request(app)
      .post(`/api/auth/company/requests/${viewerPendingRequestId}/decision`)
      .set("Cookie", authCookie!)
      .send({ decision: "approve" });

    expect(approveViewerRes.status).toBe(200);

    const viewerProfile = await request(app)
      .get("/api/auth/me")
      .set("Cookie", viewerCookie!);
    expect(viewerProfile.status).toBe(200);
    expect(viewerProfile.body.data.company.status).toBe("active");
    expect(viewerProfile.body.data.company.role).toBe("member");

    const viewerClusters = await request(app)
      .get("/api/clusters")
      .set("Cookie", viewerCookie!);
    expect(viewerClusters.status).toBe(200);
    expect(viewerClusters.body.data.some((cluster: { id: string }) => cluster.id === createdClusterId)).toBe(true);

    const viewerCreateAttempt = await request(app)
      .post("/api/clusters")
      .set("Cookie", viewerCookie!)
      .send(clusterPayload);
    expect(viewerCreateAttempt.status).toBe(403);

    const viewerDeleteAttempt = await request(app)
      .delete(`/api/clusters/${createdClusterId}`)
      .set("Cookie", viewerCookie!);
    expect(viewerDeleteAttempt.status).toBe(403);

    const adminDeleteRes = await request(app)
      .delete(`/api/clusters/${createdClusterId}`)
      .set("Cookie", authCookie!);
    expect(adminDeleteRes.status).toBe(200);
  });

  it("should search companies", async () => {
    const res = await request(app).get("/api/auth/companies").query({ q: "nebula" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty("name");
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

  it("should append war room note", async () => {
    const note = { content: "War room note from test", author: "Integration Test" };
    const res = await request(app)
      .post("/api/compliance/war-room/notes")
      .set("Cookie", authCookie!)
      .send(note);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.notes[0]).toMatchObject({
      content: note.content,
      author: note.author
    });
  });

  it("should export compliance report", async () => {
    const res = await request(app)
      .get("/api/compliance/report")
      .set("Cookie", authCookie!);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("incident");
  });
});
