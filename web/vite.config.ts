import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 将 /chat 代理到 LangGraph 后端（默认 http://localhost:3000）。
export default defineConfig(() => {
  const proxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3210";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/chat": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/health": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/skills": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
