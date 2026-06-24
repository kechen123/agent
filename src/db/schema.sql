CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'ready', 'failed')),
  error_message text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index int NOT NULL,
  embedding vector(2048) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_kb_documents_updated_at ON kb_documents;
CREATE TRIGGER set_kb_documents_updated_at
BEFORE UPDATE ON kb_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique
ON users (name)
WHERE name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kb_documents_user_created
ON kb_documents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_chunk
ON kb_chunks (document_id, chunk_index);

-- pgvector 的 HNSW 索引最多支持 2000 维；当前 doubao-embedding-vision-251215
-- 输出 2048 维，因此首版使用无索引精确检索，数据量较小时可以正常工作。
-- 如需大规模检索，请更换 <=2000 维的 embedding 模型，或增加降维/半精度索引方案。
