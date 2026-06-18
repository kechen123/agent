import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { chatRoute } from "./routes/chat.route";
import { config } from "./config";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "agent-runtime" }));

app.route("/", chatRoute);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Agent runtime listening on http://localhost:${info.port}`);
});
