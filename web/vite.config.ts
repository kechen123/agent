import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /chat to the LangGraph backend (default http://localhost:3000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/chat": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
