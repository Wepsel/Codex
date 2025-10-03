import { query } from "../lib/db";

export async function getClusterAnomalyScore(clusterConnectionId: string): Promise<{ score: number; windowMinutes: number; totalEvents: number }> {
  const windowMinutes = 15;
  const res = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM cluster_events
     WHERE cluster_connection_id = $1
       AND created_at >= NOW() - INTERVAL '${windowMinutes} minutes'`,
    [clusterConnectionId]
  );
  const count = Number(res.rows[0]?.count ?? 0);
  // Simple bounded scoring: sigmoid-ish mapping of event volume to 0..100
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-count / 20)))));
  return { score, windowMinutes, totalEvents: count };
}

export async function getClusterLogTrend(clusterConnectionId: string): Promise<Array<{ t: string; v: number }>> {
  // Return counts per minute over last 15 minutes
  const res = await query<{ bucket: string; c: number }>(
    `SELECT to_char(date_trunc('minute', log_timestamp), 'YYYY-MM-DD"T"HH24:MI:00Z') as bucket,
            COUNT(*)::int as c
       FROM cluster_log_entries
      WHERE cluster_connection_id = $1
        AND log_timestamp >= NOW() - INTERVAL '15 minutes'
      GROUP BY 1
      ORDER BY 1`,
    [clusterConnectionId]
  );
  return res.rows.map(r => ({ t: r.bucket, v: r.c }));
}


