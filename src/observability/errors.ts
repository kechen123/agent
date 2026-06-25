import type { ErrorCode } from "../types/agent";
import { getRequestContext } from "./request-context";

export { type ErrorCode };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, options: { status?: number; expose?: boolean } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? 500;
    this.expose = options.expose ?? this.status < 500;
  }
}

export interface PublicErrorBody {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
  };
}

/**
 * 把未知异常转换成对外安全错误。
 *
 * 对外响应不能直接暴露内部异常栈、数据库连接信息、供应商错误详情。
 * AppError.expose=true 的错误可以直接展示；未知错误统一展示“服务器内部错误”。
 */
export function toPublicError(err: unknown): PublicErrorBody["error"] {
  const context = getRequestContext();
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.expose ? err.message : "服务器内部错误",
      requestId: context?.requestId,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "服务器内部错误",
    requestId: context?.requestId,
  };
}

export function statusOfError(err: unknown): number {
  return err instanceof AppError ? err.status : 500;
}

/** 给 SSE error 事件使用的安全错误元信息。 */
export function toSseError(err: unknown): {
  code: ErrorCode;
  message: string;
  requestId?: string;
  runId?: string;
} {
  const context = getRequestContext();
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.expose ? err.message : "服务器内部错误",
      requestId: context?.requestId,
      runId: context?.runId,
    };
  }

  const message = err instanceof Error ? err.message : String(err ?? "未知错误");
  return {
    code: "INTERNAL_ERROR",
    message,
    requestId: context?.requestId,
    runId: context?.runId,
  };
}

/** 给结构化日志使用的内部错误摘要。 */
export function toLogError(err: unknown): { name: string; message: string; stack?: string; code?: string } {
  if (err instanceof AppError) {
    return { name: err.name, message: err.message, code: err.code, stack: err.stack };
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "UnknownError", message: String(err ?? "未知错误") };
}
