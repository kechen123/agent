import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { query, closeDb } from "../src/db/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  const schemaPath = resolve(__dirname, "../src/db/schema.sql");
  const sql = await readFile(schemaPath, "utf8");
  await query(sql);
  console.log("Database schema initialized.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
