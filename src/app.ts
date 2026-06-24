import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { authRoute } from "./auth/routes";
import { closeDb } from "./db/client";
import { knowledgeRoute } from "./knowledge/routes";
import { chatRoute } from "./routes/chat.route";
import { skillsRoute } from "./routes/skills.route";
import { config } from "./config";
import { bootstrapRuntime } from "./runtime/bootstrap";

bootstrapRuntime();

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "agent-runtime" }));

app.route("/", authRoute);
app.route("/", knowledgeRoute);
app.route("/", skillsRoute);
app.route("/", chatRoute);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Agent runtime listening on http://localhost:${info.port}`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Received ${signal}, shutting down...`);
  await closeDb().catch((err) => {
    console.error("Failed to close database pool", err);
  });
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
