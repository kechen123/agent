import { tool, type ToolRunnableConfig } from "@langchain/core/tools";
import { z } from "zod";
import { searchKnowledge } from "../knowledge/documentService";
import { getActiveToolUser } from "../runtime/user-context";

function formatResults(
  results: Array<{ content: string; filename: string; documentId: string; distance: number }>,
): string {
  if (results.length === 0) {
    return "未找到相关知识库片段。回答时必须说明知识库里没有找到相关信息，不要补全或编造。";
  }

  const lines = [
    `找到 ${results.length} 条相关知识库片段。以下片段是本轮回答唯一可用事实来源；片段里没有明确出现的事实，一律视为未找到。`,
  ];
  results.forEach((result, index) => {
    lines.push(
      "",
      `[${index + 1}] ${result.filename} / document_id=${result.documentId}`,
      `distance=${result.distance}`,
      "片段内容：",
      result.content,
    );
  });
  return lines.join("\n");
}

export const searchKnowledgeTool = tool(
  async ({ query }: { query: string }, config: ToolRunnableConfig) => {
    const userId =
      getActiveToolUser() ??
      (typeof config.configurable?.user_id === "string" ? config.configurable.user_id : undefined);
    if (!userId) {
      return "当前会话未绑定用户，请先登录后再使用知识库检索。";
    }

    const results = await searchKnowledge(userId, query, 5);
    return formatResults(results);
  },
  {
    name: "searchKnowledge",
    description: "检索当前登录用户上传的文档知识库，返回最相关的知识库片段。",
    schema: z.object({
      query: z.string().trim().min(1).describe("要在知识库中检索的问题或关键词"),
    }),
  },
);
