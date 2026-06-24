import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  deleteDocument,
  listDocuments,
  searchKnowledge,
  uploadDocument,
  type KnowledgeDocument,
  type KnowledgeSearchResult,
} from "../../services/knowledgeApi";

interface KnowledgePanelProps {
  token: string;
  onOpenMenu: () => void;
  onDocumentsChange?: (documents: KnowledgeDocument[]) => void;
}

const statusLabel: Record<KnowledgeDocument["status"], string> = {
  processing: "处理中",
  ready: "可检索",
  failed: "失败",
};

const statusTone: Record<KnowledgeDocument["status"], string> = {
  processing: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

export function KnowledgePanel({ token, onOpenMenu, onDocumentsChange }: KnowledgePanelProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const ready = documents.filter((document) => document.status === "ready").length;
    const processing = documents.filter((document) => document.status === "processing").length;
    const failed = documents.filter((document) => document.status === "failed").length;
    const chunks = documents.reduce((sum, document) => sum + document.chunkCount, 0);
    return { ready, processing, failed, chunks };
  }, [documents]);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await listDocuments(token);
      setDocuments(next);
      onDocumentsChange?.(next);
    } catch (err) {
      setError((err as Error).message || "文档列表加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [onDocumentsChange, token]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);
    try {
      await uploadDocument(token, file);
      setFile(null);
      setFileInputKey((value) => value + 1);
      await loadDocuments();
    } catch (err) {
      setError((err as Error).message || "上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除这个文档吗？对应向量也会一起删除。")) return;

    setDeletingId(id);
    setError(null);
    try {
      await deleteDocument(token, id);
      await loadDocuments();
    } catch (err) {
      setError((err as Error).message || "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = query.trim();
    if (!text || isSearching) return;

    setIsSearching(true);
    setError(null);
    try {
      const next = await searchKnowledge(token, text);
      setResults(next);
    } catch (err) {
      setError((err as Error).message || "搜索失败");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[#fbfaf8]">
      <header className="flex h-16 shrink-0 items-center justify-between bg-[#fbfaf8]/95 px-3 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/5 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 md:hidden"
            aria-label="打开导航"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-neutral-950">知识库</h1>
            <p className="truncate text-xs text-neutral-500">
              上传资料、查看入库状态，并直接测试向量检索结果
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadDocuments()}
          disabled={isLoading}
          className="shrink-0 whitespace-nowrap rounded-full bg-neutral-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
        >
          {isLoading ? "刷新中" : "刷新"}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          {error && (
            <div className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="可检索文档" value={stats.ready} tone="text-emerald-700" />
            <StatCard label="处理中" value={stats.processing} tone="text-amber-700" />
            <StatCard label="失败" value={stats.failed} tone="text-red-700" />
            <StatCard label="向量片段" value={stats.chunks} tone="text-neutral-950" />
          </div>

          <div className="grid min-h-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <section className="rounded-[2rem] bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-950">上传文档</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    支持 txt / md / pdf / docx。上传后会解析、切分并写入 2048 维向量。
                  </p>
                </div>
                <form onSubmit={handleUpload} className="mt-5 space-y-4">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] bg-neutral-50 px-4 py-8 text-center transition hover:bg-neutral-100">
                    <input
                      key={fileInputKey}
                      type="file"
                      accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-neutral-950">
                      {file ? file.name : "选择或拖入文档"}
                    </span>
                    <span className="mt-1 text-xs text-neutral-500">
                      {file ? "点击可重新选择文件" : "建议单个文档控制在可解析范围内"}
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={!file || isUploading}
                    className="inline-flex rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploading ? "上传入库中" : "上传并入库"}
                  </button>
                </form>
              </section>

              <section className="rounded-[2rem] bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-950">文档列表</h2>
                    <p className="mt-1 text-xs text-neutral-500">当前账号可用于 RAG 的资料</p>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <div className="mt-4 rounded-[1.5rem] bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                    暂无文档，先上传一个资料再测试检索。
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {documents.map((document) => (
                      <article key={document.id} className="rounded-[1.5rem] bg-neutral-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-neutral-950">
                              {document.originalName}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                              <span className={`rounded-full px-2.5 py-1 font-medium ${statusTone[document.status]}`}>
                                {statusLabel[document.status]}
                              </span>
                              <span>{document.chunkCount} chunks</span>
                              <span>{new Date(document.updatedAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDelete(document.id)}
                            disabled={deletingId === document.id}
                            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:opacity-50"
                          >
                            {deletingId === document.id ? "删除中" : "删除"}
                          </button>
                        </div>
                        {document.errorMessage && (
                          <div className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                            {document.errorMessage}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="flex min-h-[560px] flex-col rounded-[2rem] bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-950">检索测试</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    这里用于检查向量召回质量；正式聊天默认自动检索知识库，必要时也可以切到 <span className="font-medium text-neutral-900">仅知识库</span> 模式强制检索。
                  </p>
                </div>
                <span className="hidden rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 sm:inline-flex">
                  topK 5
                </span>
              </div>

              <form onSubmit={handleSearch} className="mt-5 flex gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="输入要检索的问题"
                  className="min-w-0 flex-1 rounded-full bg-neutral-50 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || isSearching}
                  className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSearching ? "搜索中" : "搜索"}
                </button>
              </form>

              <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] bg-neutral-50 px-6 text-center">
                    <div className="text-sm font-medium text-neutral-900">还没有搜索结果</div>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                      输入一个真实业务问题，观察召回片段是否覆盖答案所需事实。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results.map((result, index) => (
                      <article key={`${result.documentId}-${index}`} className="rounded-[1.5rem] bg-neutral-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-neutral-500">
                          <span className="truncate">{result.filename}</span>
                          <span>distance={result.distance.toFixed(4)}</span>
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                          {result.content}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
      <div className={`text-2xl font-semibold tracking-tight ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-neutral-500">{label}</div>
    </div>
  );
}
