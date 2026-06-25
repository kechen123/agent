import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { authRoute } from "./auth/routes";
import { closeDb } from "./db/client";
import { knowledgeRoute } from "./knowledge/routes";
import { healthRoute } from "./routes/health.route";
import { chatRoute } from "./routes/chat.route";
import { skillsRoute } from "./routes/skills.route";
import { config, validateRuntimeConfig } from "./config";
import { logger } from "./observability/logger";
import { bootstrapRuntime } from "./runtime/bootstrap";

bootstrapRuntime();

const app = new Hono();

app.route("/", healthRoute);

app.route("/", authRoute);
app.route("/", knowledgeRoute);
app.route("/", skillsRoute);
app.route("/", chatRoute);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info("app.start", {
    service: "agent-runtime",
    port: info.port,
    modelName: config.modelName,
    embeddingModel: config.embeddingModel,
    embeddingDim: config.embeddingDim,
    uploadDir: config.uploadDir,
  });

  const configCheck = validateRuntimeConfig();
  for (const issue of configCheck.issues) {
    logger.warn("config.validation.warning", { ...issue });
  }
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
