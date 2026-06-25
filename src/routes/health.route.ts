import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { config, validateRuntimeConfig } from "../config";
import { checkDbReady } from "../db/client";
import { createRequestId } from "../observability/ids";
import { logger } from "../observability/logger";
import { runWithRequestContext } from "../observability/request-context";
import { durationSince, nowMs } from "../observability/timing";
import { toLogError } from "../observability/errors";

export const healthRoute = new Hono();

/**
 * GET /health：进程存活检查。
 *
 * 它只说明 Hono 进程能响应请求，不检查数据库、模型或配置。
 * 这样部署平台做 liveness probe 时，不会因为数据库短暂抖动而误杀进程。
 */
healthRoute.get("/health", (c) => {
  const requestId = c.req.header("X-Request-Id") || createRequestId();
  return runWithRequestContext({ requestId }, () => {
    c.header("X-Request-Id", requestId);
    return c.json({ ok: true, service: "agent-runtime", requestId });
  });
});

type ReadyCheck = {
  ok: boolean;
  code?: string;
  message?: string;
  durationMs?: number;
  configured?: boolean;
  dimension?: number;
};

/**
 * GET /ready：运行就绪检查。
 *
 * 它回答“当前服务是否准备好承接真实请求”：
 * - config：关键环境变量是否齐全；
 * - database：PostgreSQL 是否可连接；
 * - llm/embedding：只做配置级检查，不调用外部模型 API。
 */
healthRoute.get("/ready", async (c) => {
  const requestId = c.req.header("X-Request-Id") || createRequestId();
  return runWithRequestContext({ requestId }, async () => {
    const startedAt = nowMs();
    c.header("X-Request-Id", requestId);
    logger.info("ready.check.start");

    const configCheck = validateRuntimeConfig();
    const checks: Record<string, ReadyCheck> = {
      config: configCheck.ok
        ? { ok: true }
        : {
            ok: false,
            code: "CONFIG_ERROR",
            message: configCheck.issues.map((issue) => `${issue.key}: ${issue.message}`).join("；"),
          },
      llm: {
        ok: Boolean(config.apiKey && config.baseURL && config.modelName),
        configured: Boolean(config.apiKey && config.baseURL && config.modelName),
      },
      embedding: {
        ok: Boolean(config.embeddingApiKey && config.embeddingBaseURL && config.embeddingModel && config.embeddingDim > 0),
        configured: Boolean(config.embeddingApiKey && config.embeddingBaseURL && config.embeddingModel),
        dimension: config.embeddingDim,
      },
    };

    const dbStartedAt = nowMs();
    try {
      await checkDbReady();
      checks.database = { ok: true, durationMs: durationSince(dbStartedAt) };
      logger.info("ready.database.check", { ok: true, durationMs: checks.database.durationMs });
    } catch (err) {
      checks.database = {
        ok: false,
        code: "DATABASE_ERROR",
        message: "数据库连接失败",
        durationMs: durationSince(dbStartedAt),
      };
      logger.error("ready.database.check", { ok: false, error: toLogError(err), durationMs: checks.database.durationMs });
    }

    const ok = Object.values(checks).every((check) => check.ok);
    const durationMs = durationSince(startedAt);
    logger.info("ready.check.end", { ok, durationMs });

    return c.json(
      { ok, service: "agent-runtime", checks, requestId, durationMs },
      (ok ? 200 : 503) as ContentfulStatusCode,
    );
  });
});
