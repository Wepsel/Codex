import { randomUUID } from "crypto";
import type { ClusterEvent } from "@kube-suite/shared";
import { query } from "../lib/db";

function resolveEventTimestamp(event: ClusterEvent): string {
  const candidates = [
    (event as unknown as { timestamp?: string }).timestamp,
    (event as unknown as { eventTime?: string }).eventTime,
    (event as unknown as { lastTimestamp?: string }).lastTimestamp,
    (event as unknown as { firstTimestamp?: string }).firstTimestamp
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

const INSERT_EVENT_SQL = `INSERT INTO cluster_events (
    id,
    cluster_connection_id,
    event_type,
    event_data,
    created_at
  ) VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (id) DO UPDATE SET
    cluster_connection_id = EXCLUDED.cluster_connection_id,
    event_type = EXCLUDED.event_type,
    event_data = EXCLUDED.event_data,
    created_at = EXCLUDED.created_at`;

const INSERT_LOG_SQL = `INSERT INTO cluster_log_entries (
    id,
    cluster_connection_id,
    namespace,
    pod,
    container,
    level,
    message,
    log_timestamp,
    created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`;

export async function persistClusterEvents(
  _companyId: string,
  clusterConnectionId: string,
  events: ClusterEvent[]
): Promise<void> {
  if (events.length === 0) return;

  for (const ev of events) {
    const createdAt = resolveEventTimestamp(ev);
    await query(INSERT_EVENT_SQL, [
      ev.id,
      clusterConnectionId,
      "message_received",
      JSON.stringify(ev),
      createdAt
    ]);
  }
}

export async function persistClusterLogs(
  clusterConnectionId: string,
  entries: Array<{ namespace: string; pod: string; container: string; level: string; message: string; timestamp: string }>
): Promise<void> {
  if (entries.length === 0) return;

  for (const entry of entries) {
    await query(INSERT_LOG_SQL, [
      randomUUID(),
      clusterConnectionId,
      entry.namespace,
      entry.pod,
      entry.container,
      entry.level,
      entry.message,
      entry.timestamp
    ]);
  }
}
