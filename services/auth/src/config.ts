export interface AuthConfig {
  port: number;
  host: string;
  issuer: string;
  audience: string;
  kid: string;
  tokenTtlSeconds: number;
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
export function loadConfig(env: Env = process.env): AuthConfig {
  return {
    port: intEnv(env, "AUTH_PORT", 6060),
    host: env.AUTH_HOST ?? "0.0.0.0",
    issuer: env.AUTH_JWT_ISSUER ?? "foss-tasks-auth",
    audience: env.AUTH_JWT_AUDIENCE ?? "powersync",
    kid: env.AUTH_JWT_KID ?? "auth-key-1",
    tokenTtlSeconds: intEnv(env, "AUTH_JWT_TTL_SECONDS", 3600),
    // Newlines in .env are commonly escaped as literal "\n"; restore them.
    privateKeyPem: required(env, "AUTH_JWT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    databaseUrl: required(env, "AUTH_DATABASE_URL"),
  };
}
