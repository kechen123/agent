import type { StructuredTool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { config } from "../config";
import type { RegisteredTool } from "../types/agent";

const registry = new Map<string, RegisteredTool>();

/** 注册一个工具。同名工具会被覆盖。 */
export function registerTool(tool: StructuredTool): void {
  registry.set(tool.name, {
    name: tool.name,
    description: tool.description ?? "",
    tool,
  });
}

/** 返回已注册工具；如果设置了 ENABLED_TOOLS，则按其过滤。 */
export function getTools(): StructuredTool[] {
  const all = Array.from(registry.values()).map((t) => t.tool);
  const enabled = config.enabledTools;
  if (enabled.length === 0) return all;
  return all.filter((t) => enabled.includes(t.name));
}

/**
 * 按名称返回工具，用于落实 Skill 的工具白名单。
 *
 * 注意 `undefined` 和空数组的语义不同：
 * - undefined：Skill 没有声明白名单，返回全部全局启用工具；
 * - []：Skill 明确禁止工具，返回空数组。
 */
export function getToolsByName(names?: string[]): StructuredTool[] {
  if (names === undefined) return getTools();
  if (names.length === 0) return [];
  const enabledTools = getTools();
  return enabledTools.filter((tool) => names.includes(tool.name));
}

export function getRegisteredTools(): RegisteredTool[] {
  return Array.from(registry.values());
}

/** 构建 ToolNode。传入工具名时，会同时应用全局开关和 Skill 白名单。 */
export function createToolNode(toolNames?: string[]): ToolNode {
  return new ToolNode(getToolsByName(toolNames));
}
