import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { PgAuthRepo } from "./db/pg-repo.js";
import { loadSigningKey } from "./keys.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const signingKey = await loadSigningKey(config.privateKeyPem, config.kid);
  const pool = new Pool({ connectionString: config.databaseUrl });
  const repo = new PgAuthRepo(pool);

  const app = buildServer({
    repo,
    signingKey,
    issuer: config.issuer,
    audience: config.audience,
    tokenTtlSeconds: config.tokenTtlSeconds,
  });

  const shutdown = async (signal: string) => {
    app.log.info?.(`received ${signal}, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ port: config.port, host: config.host });
  // eslint-disable-next-line no-console
  console.log(`auth service listening on ${config.host}:${config.port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("auth service failed to start:", err);
  process.exit(1);
});
