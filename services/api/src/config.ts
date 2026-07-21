export interface ApiConfig {
  port: number;
  host: string;
  issuer: string;
  audience: string;
  kid: string;
  tokenTtlSeconds: number;
  sessionMaxAgeSeconds: number;
  privateKeyPem: string;
  databaseUrl: string;
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function intEnv(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid integer for ${name}: ${raw}`);
  return parsed;
}

/** Reads configuration from the given environment. Throws on missing required keys. */
export function loadConfig(env: Env = process.env): ApiConfig {
  return {
    port: intEnv(env, "API_PORT", 6060),
    host: env.API_HOST ?? "0.0.0.0",
    issuer: env.API_JWT_ISSUER ?? "foss-tasks-auth",
    audience: env.API_JWT_AUDIENCE ?? "powersync",
    kid: env.API_JWT_KID ?? "auth-key-1",
    // Short by design: `POST /auth/token` re-issues automatically, so a brief
    // TTL costs nothing and narrows the window a leaked token is useful for.
    // The session itself is bounded by API_SESSION_MAX_AGE_SECONDS instead.
    tokenTtlSeconds: intEnv(env, "API_JWT_TTL_SECONDS", 900),
    sessionMaxAgeSeconds: intEnv(env, "API_SESSION_MAX_AGE_SECONDS", 30 * 24 * 60 * 60),
    // Newlines in .env are commonly escaped as literal "\n"; restore them.
    privateKeyPem: required(env, "API_JWT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    databaseUrl: required(env, "API_DATABASE_URL"),
  };
}
