export type KnowledgeDocument = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  status: "processing" | "ready" | "failed";
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

async function parseError(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return new Error(body.error);
    if (body.error) return new Error(JSON.stringify(body.error));
  } catch {
    // ignore non-JSON errors
  }
  return new Error(`请求失败：${res.status} ${res.statusText}`);
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listDocuments(token: string): Promise<KnowledgeDocument[]> {
  const res = await fetch("/api/knowledge/documents", {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { documents: KnowledgeDocument[] };
  return body.documents;
}

export async function uploadDocument(token: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/knowledge/documents", {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) throw await parseError(res);
}

export async function deleteDocument(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseError(res);
}

export async function searchKnowledge(
  token: string,
  query: string,
): Promise<KnowledgeSearchResult[]> {
  const res = await fetch("/api/knowledge/search", {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, topK: 5 }),
  });
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { results: KnowledgeSearchResult[] };
  return body.results;
}
