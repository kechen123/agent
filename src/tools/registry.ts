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

/** 按名称返回工具，用于获取某个 skill 允许使用的工具集。 */
export function getToolsByName(names?: string[]): StructuredTool[] {
  if (!names || names.length === 0) return getTools();
  const all = Array.from(registry.values()).map((t) => t.tool);
  return all.filter((t) => names.includes(t.name));
}

export function getRegisteredTools(): RegisteredTool[] {
  return Array.from(registry.values());
}

/** 构建绑定了启用工具的 ToolNode，供 runtime graph 使用。 */
export function createToolNode(): ToolNode {
  return new ToolNode(getTools());
}
