import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { model } from "../../services/llm";
import { getToolsByName } from "../../tools";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";
import { getCurrentTurnMessages } from "../../runtime/messages";
import { getSkillByName, skillPromptForState, withSkillPrompt } from "../../skills";

const SYSTEM_PROMPT = `你是一个工具调用助手，负责使用工具来完成用户的查询请求。

## 工作方式
1. 分析用户请求，判断需要使用哪些工具
2. 调用相应工具获取结果
3. 如果需要更多工具，继续调用
4. 拿到全部结果后，简要总结工具返回的内容

## 注意事项
- 不要编造工具返回结果中没有的数据
- 你的总结会被后续的 Reply Agent 进一步整理，所以保持简洁即可`;

const buildChain = (
  systemPrompt: string,
  tools: ReturnType<typeof getToolsByName>,
) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["placeholder", "{messages}"],
  ]);

  // 没有可用工具时仍允许模型生成一段内部总结，然后进入 ReplyAgent。
  return tools.length > 0 ? prompt.pipe(model.bindTools(tools)) : prompt.pipe(model);
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
    const skill = state.skillName ? getSkillByName(state.skillName) : undefined;
    const tools = getToolsByName(skill?.tools);

    if (tools.length === 0) {
      const reason = state.skillName
        ? `Skill "${state.skillName}" 没有允许当前可用工具`
        : "当前没有注册或启用任何工具";
      return {
        messages: [new AIMessage({ content: reason, name: "toolAgent" })],
        errors: [...state.errors, reason],
      };
    }

    const remainingCalls = Math.max(0, state.maxToolCalls - state.toolCallCount);
    const limitPrompt =
      remainingCalls === 0
        ? "\n\n本轮工具调用次数已达到上限。不要再调用工具，请基于已有结果结束工具阶段。"
        : `\n\n本轮最多还可以发起 ${remainingCalls} 次工具调用。`;
    const chain = buildChain(
      withSkillPrompt(`${SYSTEM_PROMPT}${limitPrompt}`, skillPromptForState(state)),
      tools,
    );
    const res = await chain.invoke({ messages: getCurrentTurnMessages(state.messages) });
    res.name = "toolAgent";

    const calls = res.tool_calls ?? [];
    if (calls.length > remainingCalls) {
      // 模型可能一次生成多个调用；这里只保留剩余额度内的调用。
      res.tool_calls = calls.slice(0, remainingCalls);
    }

    return {
      messages: [res as AIMessage],
      toolCallCount: state.toolCallCount + (res.tool_calls?.length ?? 0),
    };
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
