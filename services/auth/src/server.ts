import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { authenticate } from "./domain/authenticate.js";
import { signAccessToken } from "./domain/jwt.js";
import { hashPassword, verifyPassword } from "./domain/password.js";
import { registerAccount } from "./domain/register.js";
import type { AuthRepo } from "./domain/types.js";
import type { SigningKey } from "./keys.js";

export interface ServerDeps {
  repo: AuthRepo;
  signingKey: SigningKey;
  issuer: string;
  audience: string;
  tokenTtlSeconds: number;
  now?: () => Date;
}

interface Credentials {
  email: unknown;
  password: unknown;
}

function readCredentials(body: unknown): { email: string; password: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const { email, password } = body as Credentials;
  if (typeof email !== "string" || typeof password !== "string") return null;
  return { email, password };
}

/**
 * Builds the auth HTTP app. Pure over its dependencies so tests can drive it
 * with an in-memory repo and a fixed clock.
 */
export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  const now = deps.now ?? (() => new Date());

  async function issueToken(subject: string, personalSpaceId: string) {
    const token = await signAccessToken({
      privateKey: deps.signingKey.privateKey,
      kid: deps.signingKey.kid,
      issuer: deps.issuer,
      audience: deps.audience,
      subject,
      ttlSeconds: deps.tokenTtlSeconds,
      now,
      extraClaims: { personal_space_id: personalSpaceId },
    });
    return {
      access_token: token,
      token_type: "Bearer",
      expires_in: deps.tokenTtlSeconds,
    };
  }

  app.get("/health", async () => ({ status: "ok" }));

  // JWKS endpoint PowerSync's client_auth.jwks_uri points at.
  app.get("/api/auth/keys", async () => ({ keys: [deps.signingKey.jwk] }));

  app.post("/auth/register", async (request, reply) => {
    const creds = readCredentials(request.body);
    if (!creds) return reply.code(400).send({ error: "invalid_request" });

    const result = await registerAccount(
      { repo: deps.repo, hashPassword, generateId: randomUUID, now },
      creds,
    );

    if (!result.ok) {
      const status = result.error === "email_taken" ? 409 : 400;
      return reply.code(status).send({ error: result.error });
    }

    const token = await issueToken(result.accountId, result.spaceId);
    return reply.code(201).send({
      ...token,
      account_id: result.accountId,
      personal_space_id: result.spaceId,
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const creds = readCredentials(request.body);
    if (!creds) return reply.code(400).send({ error: "invalid_request" });

    const result = await authenticate({ repo: deps.repo, verifyPassword }, creds);
    if (!result.ok) return reply.code(401).send({ error: result.error });

    const token = await issueToken(result.account.id, result.account.personalSpaceId);
    return reply.code(200).send({
      ...token,
      account_id: result.account.id,
      personal_space_id: result.account.personalSpaceId,
    });
  });

  return app;
}
