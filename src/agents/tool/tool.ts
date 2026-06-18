import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { model } from "../../services/llm";
import { getTools } from "../../tools";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";

const SYSTEM_PROMPT = `你是一个工具调用助手，负责使用工具来完成用户的查询请求。

## 工作方式
1. 分析用户请求，判断需要使用哪些工具
2. 调用相应工具获取结果
3. 如果需要更多工具，继续调用
4. 拿到全部结果后，简要总结工具返回的内容

## 注意事项
- 不要编造工具返回结果中没有的数据
- 你的总结会被后续的 Reply Agent 进一步整理，所以保持简洁即可`;

const buildChain = () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    ["placeholder", "{messages}"],
  ]);
  // Bind all enabled tools from the registry (graph.ts never hardcodes tools).
  return prompt.pipe(model.bindTools(getTools()));
};

/**
 * ToolAgent — orchestrates tool calls.
 * NOTE: its own streamed content is filtered out by the stream adapter; only
 * ReplyAgent emits user-facing `message:delta`. This node's job is to drive
 * the tool loop; the final natural-language reply is produced by ReplyAgent.
 */
export const ToolAgent: AgentDefinition = {
  name: "toolAgent",
  description: "调用工具完成用户请求",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const chain = buildChain();
    const res = await chain.invoke({ messages: state.messages });
    return { messages: [res as AIMessage] };
  },
};

/** Conditional edge: if the model emitted tool_calls → tools node, else → reply. */
export function routeAfterTool(state: AgentRuntimeState): "tools" | "reply" {
  const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMsg && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
    return "tools";
  }
  return "reply";
}
