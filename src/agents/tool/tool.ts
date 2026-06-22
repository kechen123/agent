import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { model } from "../../services/llm";
import { getTools } from "../../tools";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";
import { getCurrentTurnMessages } from "../../runtime/messages";
import { skillPromptForState, withSkillPrompt } from "../../skills";

const SYSTEM_PROMPT = `你是一个工具调用助手，负责使用工具来完成用户的查询请求。

## 工作方式
1. 分析用户请求，判断需要使用哪些工具
2. 调用相应工具获取结果
3. 如果需要更多工具，继续调用
4. 拿到全部结果后，简要总结工具返回的内容

## 注意事项
- 不要编造工具返回结果中没有的数据
- 你的总结会被后续的 Reply Agent 进一步整理，所以保持简洁即可`;

const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["placeholder", "{messages}"],
  ]);
  // 从注册表绑定所有启用的工具（graph.ts 不硬编码工具）。
  return prompt.pipe(model.bindTools(getTools()));
};

/**
 * ToolAgent — 编排工具调用。
 * 注意：它自身的流式内容会被 stream adapter 过滤；只有 ReplyAgent
 * 会产生面向用户的 `message:delta`。本节点负责驱动工具循环；
 * 最终自然语言回复由 ReplyAgent 生成。
 */
export const ToolAgent: AgentDefinition = {
  name: "toolAgent",
  description: "调用工具完成用户请求",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
    const res = await chain.invoke({ messages: getCurrentTurnMessages(state.messages) });
    res.name = "toolAgent";
    return { messages: [res as AIMessage] };
  },
};

/** 条件边：如果模型产生 tool_calls 则进入 tools 节点，否则进入 reply。 */
export function routeAfterTool(state: AgentRuntimeState): "tools" | "reply" {
  const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMsg && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
    return "tools";
  }
  return "reply";
}
