/**
 * 返回单调递增的毫秒时间。
 *
 * 使用 performance.now() 而不是 Date.now() 的原因：
 * - Date.now() 受系统时间调整影响；
 * - performance.now() 更适合计算耗时；
 * - 日志里的绝对时间仍由 logger 用 new Date().toISOString() 生成。
 */
export function nowMs(): number {
  return performance.now();
}

/** 计算从 start 到当前的耗时，保留整数毫秒，便于日志阅读。 */
export function durationSince(start: number): number {
  return Math.max(0, Math.round(nowMs() - start));
}
