import { randomUUID } from "crypto";
import { initDatabase, query } from "../lib/db";

export interface ClusterAuth {
  bearerToken?: string;
  clientCert?: string; // PEM
  clientKey?: string; // PEM
}

export interface ClusterConnection {
  id: string;
  companyId: string;
  createdBy: string;
  name: string;
  apiUrl: string;
  caCert?: string;
  insecureTLS?: boolean;
  auth: ClusterAuth;
  createdAt: string;
}

interface ClusterConnectionRow {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  api_url: string;
  ca_cert: string | null;
  insecure_tls: boolean;
  auth_bearer_token: string | null;
  auth_client_cert: string | null;
  auth_client_key: string | null;
  created_at: Date;
}

const ready = initDatabase();

function mapRow(row: ClusterConnectionRow): ClusterConnection {
  return {
    id: row.id,
    companyId: row.company_id,
    createdBy: row.created_by,
    name: row.name,
    apiUrl: row.api_url,
    caCert: row.ca_cert ?? undefined,
    insecureTLS: row.insecure_tls ?? false,
    auth: {
      bearerToken: row.auth_bearer_token ?? undefined,
      clientCert: row.auth_client_cert ?? undefined,
      clientKey: row.auth_client_key ?? undefined
    },
    createdAt: row.created_at.toISOString()
  };
}

export async function listCompanyClusters(companyId: string): Promise<ClusterConnection[]> {
  await ready;
  const result = await query<ClusterConnectionRow>(
    `SELECT
       id,
       company_id,
       created_by,
       name,
       api_url,
       ca_cert,
       insecure_tls,
       auth_bearer_token,
       auth_client_cert,
       auth_client_key,
       created_at
     FROM cluster_connections
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  );
  return result.rows.map(mapRow);
}

export async function addCompanyCluster(
  companyId: string,
  createdBy: string,
  input: Omit<ClusterConnection, "id" | "companyId" | "createdBy" | "createdAt">
): Promise<ClusterConnection> {
  await ready;
  const id = randomUUID();
  const result = await query<ClusterConnectionRow>(
    `INSERT INTO cluster_connections (
      id,
      company_id,
      created_by,
      name,
      api_url,
      ca_cert,
      insecure_tls,
      auth_bearer_token,
      auth_client_cert,
      auth_client_key,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING
      id,
      company_id,
      created_by,
      name,
      api_url,
      ca_cert,
      insecure_tls,
      auth_bearer_token,
      auth_client_cert,
      auth_client_key,
      created_at`,
    [
      id,
      companyId,
      createdBy,
      input.name,
      input.apiUrl,
      input.caCert ?? null,
      Boolean(input.insecureTLS),
      input.auth?.bearerToken ?? null,
      input.auth?.clientCert ?? null,
      input.auth?.clientKey ?? null
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to persist cluster connection");
  }
  return mapRow(row);
}

export async function getCompanyCluster(companyId: string, clusterId: string): Promise<ClusterConnection | null> {
  await ready;
  const result = await query<ClusterConnectionRow>(
    `SELECT
       id,
       company_id,
       created_by,
       name,
       api_url,
       ca_cert,
       insecure_tls,
       auth_bearer_token,
       auth_client_cert,
       auth_client_key,
       created_at
     FROM cluster_connections
     WHERE company_id = $1 AND id = $2
     LIMIT 1`,
    [companyId, clusterId]
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function removeCompanyCluster(companyId: string, clusterId: string): Promise<boolean> {
  await ready;
  const result = await query(
    `DELETE FROM cluster_connections
     WHERE company_id = $1 AND id = $2
     RETURNING id`,
    [companyId, clusterId]
  );
  return (result.rowCount ?? 0) > 0;
}

