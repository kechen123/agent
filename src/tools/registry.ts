import type { StructuredTool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { config } from "../config";
import type { RegisteredTool } from "../types/agent";

const registry = new Map<string, RegisteredTool>();

/** Register a tool. Overwrites an existing tool with the same name. */
export function registerTool(tool: StructuredTool): void {
  registry.set(tool.name, {
    name: tool.name,
    description: tool.description ?? "",
    tool,
  });
}

/** Returns the registered tools, filtered by ENABLED_TOOLS if set. */
export function getTools(): StructuredTool[] {
  const all = Array.from(registry.values()).map((t) => t.tool);
  const enabled = config.enabledTools;
  if (enabled.length === 0) return all;
  return all.filter((t) => enabled.includes(t.name));
}

/** Returns tools by name — used to fetch a skill's allowed toolset. */
export function getToolsByName(names?: string[]): StructuredTool[] {
  if (!names || names.length === 0) return getTools();
  const all = Array.from(registry.values()).map((t) => t.tool);
  return all.filter((t) => names.includes(t.name));
}

export function getRegisteredTools(): RegisteredTool[] {
  return Array.from(registry.values());
}

/** Build a ToolNode bound to the enabled tools. Used by the runtime graph. */
export function createToolNode(): ToolNode {
  return new ToolNode(getTools());
}
