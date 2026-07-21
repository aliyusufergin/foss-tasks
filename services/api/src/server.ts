import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { authenticate } from "./domain/authenticate.js";
import { signAccessToken } from "./domain/jwt.js";
import { hashPassword, verifyPassword } from "./domain/password.js";
import { registerAccount } from "./domain/register.js";
import type { AuthRepo } from "./domain/types.js";
import { verifyAccessToken } from "./domain/verify-access-token.js";
import { verifyHeldToken } from "./domain/verify-held-token.js";
import { parseWriteRequest } from "./domain/crud.js";
import type { PgWriteStore } from "./db/write-store.js";
import type { SigningKey } from "./keys.js";

export interface ServerDeps {
  repo: AuthRepo;
  signingKey: SigningKey;
  issuer: string;
  audience: string;
  tokenTtlSeconds: number;
  /** How long after sign-in a held token may still be traded for a fresh one. */
  sessionMaxAgeSeconds: number;
  /**
   * Applies PowerSync CRUD transactions to Postgres (ADR-0008). Optional so the
   * auth domain can be exercised with an in-memory repo and no database; when
   * absent, `POST /sync/write` reports the service is misconfigured.
   */
  writeStore?: PgWriteStore;
  now?: () => Date;
}

interface Credentials {
  email: unknown;
  password: unknown;
}

/** Extracts the token from an `Authorization: Bearer <token>` header. */
function readBearerToken(header: unknown): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer (.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
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

  /**
   * The token payload every successful handler returns: the signed JWT plus the
   * two identity claims the app reads back into its `Session`. `accountId` is
   * both the token's `sub` and the response's `account_id`. One builder so the
   * three routes that hand out a session can't drift in shape.
   */
  async function sessionResponse(accountId: string, personalSpaceId: string) {
    const token = await signAccessToken({
      privateKey: deps.signingKey.privateKey,
      kid: deps.signingKey.kid,
      issuer: deps.issuer,
      audience: deps.audience,
      subject: accountId,
      ttlSeconds: deps.tokenTtlSeconds,
      now,
      extraClaims: { personal_space_id: personalSpaceId },
    });
    return {
      access_token: token,
      token_type: "Bearer",
      expires_in: deps.tokenTtlSeconds,
      account_id: accountId,
      personal_space_id: personalSpaceId,
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

    return reply.code(201).send(await sessionResponse(result.accountId, result.spaceId));
  });

  app.post("/auth/login", async (request, reply) => {
    const creds = readCredentials(request.body);
    if (!creds) return reply.code(400).send({ error: "invalid_request" });

    const result = await authenticate({ repo: deps.repo, verifyPassword }, creds);
    if (!result.ok) return reply.code(401).send({ error: result.error });

    return reply
      .code(200)
      .send(await sessionResponse(result.account.id, result.account.personalSpaceId));
  });

  /**
   * Trades the held access token for a fresh one. This is what lets the app's
   * `fetchCredentials()` honour PowerSync's "always fetch a fresh set of
   * credentials" contract: PowerSync calls it on connect, shortly before expiry,
   * on expiry, on a 401, and on a WebSocket auth error, and each of those has to
   * be able to produce a *new* token or sync stalls in a 5s retry loop forever.
   *
   * It is not a refresh-token endpoint. The held token is the credential — see
   * {@link verifyHeldToken} for why `exp` is not enforced here and what bounds
   * the session instead.
   */
  app.post("/auth/token", async (request, reply) => {
    const held = readBearerToken(request.headers.authorization);
    if (held === null) return reply.code(401).send({ error: "invalid_token" });

    const verified = await verifyHeldToken({
      token: held,
      publicKey: deps.signingKey.publicKey,
      issuer: deps.issuer,
      audience: deps.audience,
      maxAgeSeconds: deps.sessionMaxAgeSeconds,
      now,
    });
    if (!verified.ok) return reply.code(401).send({ error: verified.error });

    // Re-read the Account rather than trusting the held token's claims, so a
    // deleted Account stops being renewed and the Personal Space stays current.
    const account = await deps.repo.findAccountById(verified.subject);
    if (account === null) return reply.code(401).send({ error: "invalid_token" });

    return reply.code(200).send(await sessionResponse(account.id, account.personalSpaceId));
  });

  /**
   * Applies one PowerSync device transaction to the source of truth (ADR-0008).
   * Auth is the same JWT PowerSync already verifies (RS256, `iss`, `aud`), with
   * `exp` enforced here — an expired token is simply unauthenticated.
   *
   * Always 200 for a request that reached the write store, even when every op is
   * rejected: the rejected ops are dead-lettered and returned in `rejected[]`, so
   * the client's queue drains instead of wedging on a 4xx (§9). The non-200
   * paths are 401 (auth), 400 (not a CRUD envelope), 413 (over the op limit —
   * retryable), 500 (the service was built without a write store — misconfig),
   * and 503 (Postgres unreachable — retryable).
   */
  app.post("/sync/write", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);
    if (token === null) return reply.code(401).send({ error: "invalid_token" });

    const verified = await verifyAccessToken({
      token,
      publicKey: deps.signingKey.publicKey,
      issuer: deps.issuer,
      audience: deps.audience,
      now,
    });
    if (!verified.ok) return reply.code(401).send({ error: verified.error });

    const parsed = parseWriteRequest(request.body);
    if (!parsed.ok) {
      const status = parsed.error === "too_many_ops" ? 413 : 400;
      return reply.code(status).send({ error: parsed.error });
    }

    if (!deps.writeStore) {
      return reply.code(500).send({ error: "write_store_unavailable" });
    }

    try {
      const result = await deps.writeStore.applyTransaction(
        parsed.request.ops,
        verified.accountId,
        now(),
        parsed.request.transaction_id ?? null,
      );
      return reply.code(200).send(result);
    } catch {
      // Transient (e.g. Postgres unreachable). Retryable, so the queue is not
      // discarded — the client retries the same transaction (idempotent, §13).
      return reply.code(503).send({ error: "write_failed" });
    }
  });

  return app;
}
