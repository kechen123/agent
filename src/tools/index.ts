import { registerTool } from "./registry";
import { getWeather } from "./weather.tool";

/** 注册内置工具。启动时调用一次。 */
export function registerBuiltinTools(): void {
  registerTool(getWeather);
}

export { getWeather } from "./weather.tool";
export { registerTool, getTools, getToolsByName, createToolNode } from "./registry";
