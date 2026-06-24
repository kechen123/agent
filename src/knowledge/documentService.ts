import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { getClient, query } from "../db/client";
import { chunkText } from "./chunkText";
import { embedQuery, embedTexts } from "./embeddingService";
import { parseDocument } from "./documentParser";

export type DocumentStatus = "processing" | "ready" | "failed";

export type KnowledgeDocument = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSearchResult = {
  content: string;
  filename: string;
  documentId: string;
  distance: number;
};

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function markDocumentFailed(documentId: string, message: string): Promise<void> {
  await query("DELETE FROM kb_chunks WHERE document_id = $1", [documentId]);
  await query(
    "UPDATE kb_documents SET status = 'failed', error_message = $2 WHERE id = $1",
    [documentId, message],
  );
}

export async function uploadDocument(
  userId: string,
  file: File,
): Promise<{ id: string; status: DocumentStatus; chunkCount: number }> {
  const originalName = file.name || "upload";
  const mimeType = file.type || "application/octet-stream";
  const id = uuidv4();
  const ext = extname(originalName);
  const filename = `${id}${ext}`;
  const uploadDir = config.uploadDir;
  const filePath = join(uploadDir, filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  try {
    await query(
      `INSERT INTO kb_documents (id, user_id, filename, original_name, mime_type, file_path, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'processing')`,
      [id, userId, filename, originalName, mimeType, filePath],
    );

    const text = await parseDocument({ filePath, originalName, mimeType });
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("文档没有可入库的文本内容");
    }

    const vectors = await embedTexts(chunks);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < chunks.length; i += 1) {
        await client.query(
          `INSERT INTO kb_chunks (id, document_id, content, chunk_index, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [uuidv4(), id, chunks[i], i, vectorLiteral(vectors[i])],
        );
      }

      await client.query(
        "UPDATE kb_documents SET status = 'ready', error_message = NULL WHERE id = $1",
        [id],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    return { id, status: "ready", chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markDocumentFailed(id, message).catch(() => undefined);
    await unlink(filePath).catch(() => undefined);
    throw err;
  }
}

export async function listDocuments(userId: string): Promise<KnowledgeDocument[]> {
  const result = await query<{
    id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    status: DocumentStatus;
    error_message: string | null;
    chunk_count: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT d.id, d.filename, d.original_name, d.mime_type, d.status, d.error_message,
            COUNT(c.id)::text AS chunk_count, d.created_at, d.updated_at
     FROM kb_documents d
     LEFT JOIN kb_chunks c ON c.document_id = d.id
     WHERE d.user_id = $1
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    status: row.status,
    errorMessage: row.error_message,
    chunkCount: Number(row.chunk_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  const found = await query<{ file_path: string }>(
    "SELECT file_path FROM kb_documents WHERE id = $1 AND user_id = $2",
    [documentId, userId],
  );
  const filePath = found.rows[0]?.file_path;
  if (!filePath) return false;

  const deleted = await query("DELETE FROM kb_documents WHERE id = $1 AND user_id = $2", [
    documentId,
    userId,
  ]);
  if ((deleted.rowCount ?? 0) === 0) return false;

  await unlink(filePath).catch((err) => {
    console.warn(`删除本地文件失败：${filePath}`, err);
  });
  return true;
}

export async function searchKnowledge(
  userId: string,
  searchQuery: string,
  topK = 5,
): Promise<KnowledgeSearchResult[]> {
  const limit = Math.min(Math.max(topK, 1), 20);
  const vector = await embedQuery(searchQuery);
  const result = await query<{
    content: string;
    filename: string;
    document_id: string;
    distance: number;
  }>(
    `SELECT c.content, d.filename, d.id AS document_id, c.embedding <=> $1::vector AS distance
     FROM kb_chunks c
     JOIN kb_documents d ON d.id = c.document_id
     WHERE d.user_id = $2 AND d.status = 'ready'
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    [vectorLiteral(vector), userId, limit],
  );

  return result.rows.map((row) => ({
    content: row.content,
    filename: row.filename,
    documentId: row.document_id,
    distance: Number(row.distance),
  }));
}
