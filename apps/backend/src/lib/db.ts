import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { newDb, IMemoryDb } from "pg-mem";
import env from "../config/env";
import { logger } from "./logger";

let pool: Pool | null = null;
let memoryDb: IMemoryDb | null = null;
let initPromise: Promise<void> | null = null;

const schemaStatements: string[] = [
  `CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    invite_only BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_lower_idx ON companies ((LOWER(slug)))`,
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    company_role TEXT NOT NULL CHECK (company_role IN ('admin', 'member')),
    membership_status TEXT NOT NULL CHECK (membership_status IN ('active', 'pending', 'invited', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    pending_request_id UUID,
    pending_invite_id UUID
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users ((LOWER(username)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users ((LOWER(email)))`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS company_invites (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS company_invites_company_id_idx ON company_invites(company_id)`,
  `CREATE INDEX IF NOT EXISTS company_invites_email_lower_idx ON company_invites((LOWER(email)))`,
  `CREATE TABLE IF NOT EXISTS company_join_requests (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS company_join_requests_company_id_idx ON company_join_requests(company_id)`,
  `CREATE TABLE IF NOT EXISTS cluster_connections (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    api_url TEXT NOT NULL,
    ca_cert TEXT,
    insecure_tls BOOLEAN NOT NULL DEFAULT FALSE,
    auth_bearer_token TEXT,
    auth_client_cert TEXT,
    auth_client_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS cluster_connections_company_id_idx ON cluster_connections(company_id)`,
  `CREATE TABLE IF NOT EXISTS cluster_events (
    id UUID PRIMARY KEY,
    cluster_connection_id UUID NOT NULL REFERENCES cluster_connections(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('connection_status_change', 'message_received', 'message_sent')),
    event_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS cluster_events_cluster_connection_id_idx ON cluster_events(cluster_connection_id)`,
  `CREATE TABLE IF NOT EXISTS incident_notes (
    id UUID PRIMARY KEY,
    cluster_connection_id UUID NOT NULL REFERENCES cluster_connections(id) ON DELETE CASCADE,
    author TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS incident_notes_cluster_idx ON incident_notes(cluster_connection_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS cluster_log_entries (
    id UUID PRIMARY KEY,
    cluster_connection_id UUID NOT NULL REFERENCES cluster_connections(id) ON DELETE CASCADE,
    namespace TEXT,
    pod TEXT,
    container TEXT,
    level TEXT,
    message TEXT,
    log_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS cluster_log_entries_lookup_idx ON cluster_log_entries(cluster_connection_id, namespace, pod, container, log_timestamp DESC)`,
  `CREATE TABLE IF NOT EXISTS node_cost_catalog (
    provider TEXT NOT NULL,
    instance_type TEXT NOT NULL,
    cpu_hourly NUMERIC NOT NULL,
    memory_hourly NUMERIC NOT NULL,
    PRIMARY KEY (provider, instance_type)
  )`,
  `CREATE TABLE IF NOT EXISTS optimizer_recommendations (
    id UUID PRIMARY KEY,
    cluster_connection_id UUID NOT NULL REFERENCES cluster_connections(id) ON DELETE CASCADE,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS optimizer_auto_actions (
    id UUID PRIMARY KEY,
    cluster_connection_id UUID NOT NULL REFERENCES cluster_connections(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    payload JSONB,
    status TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`
];

function createPool(): Pool {
  if (env.databaseUrl) {
    const connectionString = env.databaseUrl;
    const newPool = new Pool({ connectionString });
    newPool.on("error", error => {
      logger.error("unexpected database error", { error });
    });
    logger.info("database connected", { mode: "postgres", envFile: env.loadedEnvFile, connectionStringProvided: Boolean(env.databaseUrl) });
    return newPool;
  }

  memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memoryDb.adapters.createPg();
  const { Pool: MemoryPool } = adapter;
  const newPool = new MemoryPool();
  logger.info("database initialized in memory (pg-mem)", { envFile: env.loadedEnvFile });
  return newPool as unknown as Pool;
}

export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

async function runMigrations(): Promise<void> {
  const db = getPool();
  for (const statement of schemaStatements) {
    await db.query(statement);
  }
}

export async function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = runMigrations().catch(error => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const db = getPool();
  return db.query<T>(text, params);
}

export function isInMemoryDatabase(): boolean {
  return memoryDb !== null && !env.databaseUrl;
}


