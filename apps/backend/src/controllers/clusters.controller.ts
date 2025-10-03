import type { Response } from "express";
import type { RequestWithUser } from "../types";
import {
  addCompanyCluster,
  getCompanyCluster,
  listCompanyClusters,
  removeCompanyCluster,
  type ClusterConnection
} from "../services/cluster-registry";
import { testClusterConnection } from "../services/cluster-client";

function ensureActiveCompany(user: RequestWithUser["user"], res: Response): user is NonNullable<RequestWithUser["user"]> {
  if (!user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  if (user.company.status !== "active") {
    res.status(403).json({ ok: false, error: "Company membership is not active" });
    return false;
  }
  return true;
}

function ensureCompanyAdmin(user: RequestWithUser["user"], res: Response): user is NonNullable<RequestWithUser["user"]> {
  if (!ensureActiveCompany(user, res)) {
    return false;
  }
  if (user.company.role !== "admin") {
    res.status(403).json({ ok: false, error: "Admin role required" });
    return false;
  }
  return true;
}

function sanitizeCluster(cluster: ClusterConnection) {
  const { auth, ...rest } = cluster;
  return rest;
}

export async function createCluster(req: RequestWithUser, res: Response) {
  const user = req.user;
  if (!ensureCompanyAdmin(user, res)) {
    return;
  }

  const { name, apiUrl, caCert, insecureTLS, auth } = req.body as Partial<ClusterConnection> & { auth?: any };
  if (!name || !apiUrl || !auth || (!auth.bearerToken && !(auth.clientCert && auth.clientKey))) {
    res.status(400).json({ ok: false, error: "name, apiUrl and auth (bearerToken or client cert+key) are required" });
    return;
  }

  const created = await addCompanyCluster(user.company.id, user.id, {
    name,
    apiUrl,
    caCert,
    insecureTLS: Boolean(insecureTLS),
    auth: {
      bearerToken: auth.bearerToken,
      clientCert: auth.clientCert,
      clientKey: auth.clientKey
    }
  } as any);

  res.status(201).json({ ok: true, data: sanitizeCluster(created) });
}

export async function listClusters(req: RequestWithUser, res: Response) {
  const user = req.user;
  if (!ensureActiveCompany(user, res)) {
    return;
  }
  const list = (await listCompanyClusters(user.company.id)).map(sanitizeCluster);
  res.json({ ok: true, data: list });
}

export async function deleteCluster(req: RequestWithUser, res: Response) {
  const user = req.user;
  if (!ensureCompanyAdmin(user, res)) {
    return;
  }
  const clusterId = req.params.id;
  const ok = await removeCompanyCluster(user.company.id, clusterId);
  res.json({ ok: true, data: { removed: ok } });
}

export async function getCluster(req: RequestWithUser, res: Response) {
  const user = req.user;
  if (!ensureActiveCompany(user, res)) {
    return;
  }
  const clusterId = req.params.id;
  const found = await getCompanyCluster(user.company.id, clusterId);
  if (!found) {
    res.status(404).json({ ok: false, error: "Not found" });
    return;
  }
  res.json({ ok: true, data: sanitizeCluster(found) });
}

export async function probeClusterConnection(req: RequestWithUser, res: Response) {
  const user = req.user;
  if (!ensureActiveCompany(user, res)) {
    return;
  }
  const clusterId = req.params.id;
  const found = await getCompanyCluster(user.company.id, clusterId);
  if (!found) {
    res.status(404).json({ ok: false, error: "Not found" });
    return;
  }
  const result = await testClusterConnection(found);
  const status = result.ok ? 200 : 502;
  res.status(status).json({ ok: result.ok, data: result.ok ? result : undefined, error: result.ok ? undefined : result.error, details: (result as any).details });
}

export async function probeAdhocConnection(req: RequestWithUser, res: Response) {
  const user = req.user;
  if (!ensureCompanyAdmin(user, res)) {
    return;
  }
  const { name, apiUrl, caCert, insecureTLS, auth } = req.body as Partial<ClusterConnection> & { auth?: any };
  if (!name || !apiUrl || !auth || (!auth.bearerToken && !(auth.clientCert && auth.clientKey))) {
    res.status(400).json({ ok: false, error: "name, apiUrl and auth (bearerToken or client cert+key) are required" });
    return;
  }
  const tmpConn: ClusterConnection = {
    id: "adhoc",
    companyId: user.company.id,
    createdBy: user.id,
    createdAt: new Date().toISOString(),
    name,
    apiUrl,
    caCert,
    insecureTLS: Boolean(insecureTLS),
    auth: {
      bearerToken: auth.bearerToken,
      clientCert: auth.clientCert,
      clientKey: auth.clientKey
    }
  } as any;
  const result = await testClusterConnection(tmpConn);
  const status = result.ok ? 200 : 502;
  res.status(status).json({ ok: result.ok, data: result.ok ? result : undefined, error: result.ok ? undefined : result.error, details: (result as any).details });
}
