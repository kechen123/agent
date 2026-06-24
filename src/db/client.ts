import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { config } from "../config";

const pool = new Pool({
  connectionString: config.databaseUrl,
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL 未配置");
  }
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL 未配置");
  }
  return pool.connect();
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
