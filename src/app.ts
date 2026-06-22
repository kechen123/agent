import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { chatRoute } from "./routes/chat.route";
import { skillsRoute } from "./routes/skills.route";
import { config } from "./config";
import { bootstrapRuntime } from "./runtime/bootstrap";

bootstrapRuntime();

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "agent-runtime" }));

app.route("/", skillsRoute);
app.route("/", chatRoute);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Agent runtime listening on http://localhost:${info.port}`);
});
