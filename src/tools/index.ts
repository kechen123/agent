import { registerTool } from "./registry";
import { getWeather } from "./weather.tool";

/** Register built-in tools. Call once at startup. */
export function registerBuiltinTools(): void {
  registerTool(getWeather);
}

export { getWeather } from "./weather.tool";
export { registerTool, getTools, getToolsByName, createToolNode } from "./registry";
