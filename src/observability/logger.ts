import { getRequestContext } from "./request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

function cleanObject(value: LogFields): LogFields {
  const cleaned: LogFields = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) cleaned[key] = fieldValue;
  }
  return cleaned;
}

/**
 * 输出一行结构化 JSON 日志。
 *
 * 设计原则：
 * - 每行都是完整 JSON，方便被 Docker、云日志、日志采集器解析；
 * - 自动合并 RequestContext，避免每个调用点手动传 requestId/runId；
 * - 不在 logger 内主动打印敏感 payload，调用方也只能传安全摘要。
 */
function write(level: LogLevel, event: string, fields: LogFields = {}): void {
  const context = getRequestContext() ?? {};
  const payload = cleanObject({
    time: new Date().toISOString(),
    level,
    event,
    ...context,
    ...fields,
  });

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
