import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { PgAuthRepo } from "./db/pg-repo.js";
import { PgWriteStore } from "./db/write-store.js";
import { loadSigningKey } from "./keys.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const signingKey = await loadSigningKey(config.privateKeyPem, config.kid);
  const pool = new Pool({ connectionString: config.databaseUrl });
  const repo = new PgAuthRepo(pool);

  // Bring an existing database up to the schema this service needs (rejected_writes)
  // before serving — infra/postgres/init runs only on a fresh volume (ADR-0008 §12).
  // eslint-disable-next-line no-console
  await runMigrations(pool, (m) => console.log(`[migrate] ${m}`));

  const app = buildServer({
    repo,
    signingKey,
    writeStore: new PgWriteStore(pool),
    issuer: config.issuer,
    audience: config.audience,
    tokenTtlSeconds: config.tokenTtlSeconds,
    sessionMaxAgeSeconds: config.sessionMaxAgeSeconds,
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
  console.log(`api service listening on ${config.host}:${config.port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("api service failed to start:", err);
  process.exit(1);
});
