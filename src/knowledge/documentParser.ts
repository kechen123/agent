import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export type ParseDocumentInput = {
  filePath: string;
  originalName: string;
  mimeType: string;
};

export async function parseDocument(input: ParseDocumentInput): Promise<string> {
  const ext = extname(input.originalName).toLowerCase();
  const mime = input.mimeType.toLowerCase();

  if (ext === ".txt" || ext === ".md" || mime.startsWith("text/")) {
    return readFile(input.filePath, "utf8");
  }

  if (ext === ".pdf" || mime === "application/pdf") {
    const buffer = await readFile(input.filePath);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ path: input.filePath });
    return result.value;
  }

  throw new Error("不支持的文件格式，仅支持 txt、md、pdf、docx");
}
