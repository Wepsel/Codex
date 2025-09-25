import type { Response } from "express";
import type { RequestWithUser } from "../types";
import { addUserCluster, getUserCluster, listUserClusters, removeUserCluster, type ClusterConnection } from "../services/cluster-registry";

export async function createCluster(req: RequestWithUser, res: Response) {
  const userId = req.user!.id;
  const { name, apiUrl, caCert, insecureTLS, auth } = req.body as Partial<ClusterConnection> & { auth?: any };
  if (!name || !apiUrl || !auth || (!auth.bearerToken && !(auth.clientCert && auth.clientKey))) {
    res.status(400).json({ ok: false, error: "name, apiUrl and auth (bearerToken or client cert+key) are required" });
    return;
  }
  const created = addUserCluster(userId, {
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
  res.status(201).json({ ok: true, data: created });
}

export async function listClusters(req: RequestWithUser, res: Response) {
  const userId = req.user!.id;
  const list = listUserClusters(userId).map(c => ({ ...c, auth: undefined }));
  res.json({ ok: true, data: list });
}

export async function deleteCluster(req: RequestWithUser, res: Response) {
  const userId = req.user!.id;
  const clusterId = req.params.id;
  const ok = removeUserCluster(userId, clusterId);
  res.json({ ok: true, data: { removed: ok } });
}

export async function getCluster(req: RequestWithUser, res: Response) {
  const userId = req.user!.id;
  const clusterId = req.params.id;
  const found = getUserCluster(userId, clusterId);
  if (!found) {
    res.status(404).json({ ok: false, error: "Not found" });
    return;
  }
  res.json({ ok: true, data: { ...found, auth: undefined } });
}


