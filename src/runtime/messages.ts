import type { BaseMessage } from "@langchain/core/messages";

function messageType(message: BaseMessage): string {
  return message.getType();
}

export function messageText(message: BaseMessage | undefined): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .map((part) => (typeof part === "string" ? part : "text" in part ? String(part.text ?? "") : ""))
    .join("");
}

export function getLatestHumanMessage(messages: BaseMessage[]): BaseMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messageType(messages[index]) === "human") return messages[index];
  }
  return undefined;
}

/**
 * 返回可作为真实对话历史发送给模型的消息。
 * ToolMessage、带 tool_calls 的 AIMessage 以及内部 Agent 消息不会混入普通聊天上下文。
 */
export function getConversationMessages(messages: BaseMessage[], limit = 16): BaseMessage[] {
  return messages
    .filter((message) => {
      const type = messageType(message);
      if (type === "human") return true;
      if (type !== "ai") return false;

      const ai = message as BaseMessage & {
        name?: string;
        tool_calls?: unknown[];
      };
      if (ai.name && ai.name !== "replyAgent") return false;
      return !ai.tool_calls?.length;
    })
    .slice(-limit);
}

/** 返回从最近一条用户消息开始的工作消息，供工具循环使用。 */
export function getCurrentTurnMessages(messages: BaseMessage[]): BaseMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messageType(messages[index]) === "human") return messages.slice(index);
  }
  return messages.slice(-1);
}
