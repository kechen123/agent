import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { model } from "../../services/llm";
import { skillCatalogText, listSkills } from "../../skills";
import type { Route } from "../../types/agent";
import type { AgentDefinition } from "../base";

const RouteSchema = z.object({
  route: z
    .enum(["chat", "tool", "plan", "execute"])
    .describe("路由类别: chat=闲聊, tool=工具调用, plan=任务规划, execute=执行任务"),
  skillName: z
    .string()
    .nullable()
    .describe("匹配的 skill 名称，没有则返回 null"),
});

const SYSTEM_PROMPT = `你是一个智能路由分析器。分析用户的最新消息，判断其意图类型：
- chat    → 日常闲聊、问候、寒暄、情感表达
- tool    → 需要调用工具（查询天气等明确需要外部数据或执行操作的任务）
- plan    → 需要规划任务（将复杂任务拆解为多个可执行步骤）
- execute → 需要执行任务（已经有明确的执行计划，正在执行中）

同时，如果用户的问题属于某个 skill 的领域，请返回对应的 skillName；否则返回 null。

可用 skill 列表：
{skillCatalog}

请准确判断意图类型，并返回 route 与 skillName。`;

const routerModel = model.withStructuredOutput(RouteSchema, {
  name: "route_user_intent",
  method: "functionCalling",
});

const buildChain = () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    ["placeholder", "{messages}"],
  ]);
  return prompt.pipe(routerModel);
};

export const RouterAgent: AgentDefinition = {
  name: "routerAgent",
  description: "分析用户意图并选择路由与 skill",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const chain = buildChain();
    const res = await chain.invoke({
      messages: state.messages,
      skillCatalog: skillCatalogText(),
    });

    // Validate skillName against actually registered skills.
    const validSkills = listSkills().map((s) => s.name);
    const skillName =
      res.skillName && validSkills.includes(res.skillName) ? res.skillName : null;

    const route = res.route as Route;
    console.log("[Router]", { route, skillName });
    return { route, skillName };
  },
};

/** Conditional edge: route from routerAgent based on state.route. */
export function routeAfterRouter(state: {
  route: Route | "";
}): Route {
  const route = state.route;
  if (route === "tool") return "tool";
  if (route === "plan") return "plan";
  if (route === "execute") return "execute";
  return "chat"; // default fallback → chat
}
