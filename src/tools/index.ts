import { registerTool } from "./registry";
import { searchKnowledgeTool } from "./searchKnowledge.tool";
import { getWeather } from "./weather.tool";

/** 注册内置工具。启动时调用一次。 */
export function registerBuiltinTools(): void {
  registerTool(getWeather);
  registerTool(searchKnowledgeTool);
}

export { getWeather } from "./weather.tool";
export { searchKnowledgeTool } from "./searchKnowledge.tool";
export { registerTool, getTools, getToolsByName, createToolNode } from "./registry";
