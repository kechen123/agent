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

/**
 * 数据库就绪检查。
 *
 * 这里只执行 SELECT 1，避免 readiness 接口对数据库造成额外压力。
 * 如果 DATABASE_URL 缺失或数据库不可连接，调用方会把它转换成 /ready 的失败项。
 */
export async function checkDbReady(): Promise<void> {
  await query("SELECT 1");
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
