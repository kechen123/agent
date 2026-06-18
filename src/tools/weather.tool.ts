import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getWeather = tool(
  async ({ city }: { city: string }) => {
    // ★ Mock weather data — replace with a real API call in production.
    const mockWeather: Record<string, string> = {
      北京: "晴，25°C，湿度 40%，西北风 3 级",
      上海: "多云，28°C，湿度 65%，东南风 2 级",
      东京: "小雨，22°C，湿度 75%，东北风 4 级",
      纽约: "阴，18°C，湿度 55%，西风 3 级",
    };
    return mockWeather[city] ?? "未知城市";
  },
  {
    name: "getWeather",
    description: "获取城市天气信息",
    schema: z.object({
      city: z.string().describe("城市名称"),
    }),
  },
);
