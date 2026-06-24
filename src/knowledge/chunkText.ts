export type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 800;
  const overlap = options.overlap ?? 100;
  if (chunkSize <= 0) {
    throw new Error("chunkSize 必须大于 0");
  }
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap 必须大于等于 0 且小于 chunkSize");
  }

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = end - overlap;
  }

  return chunks;
}
