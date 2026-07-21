import {
  createLocalJWKSet,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { loadSigningKey } from "../src/keys.js";
import { buildServer } from "../src/server.js";
import type { ServerDeps } from "../src/server.js";
import { InMemoryAuthRepo } from "./support/in-memory-repo.js";

const ISSUER = "foss-tasks-auth";
const AUDIENCE = "powersync";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const HOUR = 60 * 60;

async function makeDeps(): Promise<ServerDeps> {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  const signingKey = await loadSigningKey(await exportPKCS8(privateKey), "kid-1");
  return {
    repo: new InMemoryAuthRepo(),
    signingKey,
    issuer: ISSUER,
    audience: AUDIENCE,
    tokenTtlSeconds: 900,
    sessionMaxAgeSeconds: SESSION_MAX_AGE,
  };
}

describe("auth server", () => {
  let deps: ServerDeps;

  beforeEach(async () => {
    deps = await makeDeps();
  });

  it("serves a JWKS at /api/auth/keys with only public material", async () => {
    const app = buildServer(deps);
    const res = await app.inject({ method: "GET", url: "/api/auth/keys" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { keys: Array<Record<string, unknown>> };
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]?.d).toBeUndefined();
    await app.close();
  });

  it("registers an account and returns a PowerSync-verifiable token", async () => {
    const app = buildServer(deps);
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "alice@example.com", password: "supersecret" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      access_token: string;
      account_id: string;
      personal_space_id: string;
      token_type: string;
    };
    expect(body.token_type).toBe("Bearer");
    expect(body.account_id).toBeTruthy();
    expect(body.personal_space_id).toBeTruthy();

    const jwks = createLocalJWKSet({ keys: [deps.signingKey.jwk] });
    const { payload } = await jwtVerify(body.access_token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    // sub is what PowerSync sync rules read as request.user_id().
    expect(payload.sub).toBe(body.account_id);
    expect(payload.personal_space_id).toBe(body.personal_space_id);
    await app.close();
  });

  it("rejects duplicate registration with 409", async () => {
    const app = buildServer(deps);
    const payload = { email: "alice@example.com", password: "supersecret" };
    await app.inject({ method: "POST", url: "/auth/register", payload });
    const res = await app.inject({ method: "POST", url: "/auth/register", payload });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("rejects a bad payload with 400", async () => {
    const app = buildServer(deps);
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "alice@example.com" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("logs in with correct credentials and 401s on wrong password", async () => {
    const app = buildServer(deps);
    const payload = { email: "alice@example.com", password: "supersecret" };
    await app.inject({ method: "POST", url: "/auth/register", payload });

    const ok = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload,
    });
    expect(ok.statusCode).toBe(200);

    const bad = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "alice@example.com", password: "wrongpassword" },
    });
    expect(bad.statusCode).toBe(401);
    await app.close();
  });

  describe("POST /auth/token", () => {
    /** Registers an account and returns the session payload it was issued. */
    async function register(at: Date) {
      const app = buildServer({ ...deps, now: () => at });
      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: "alice@example.com", password: "supersecret" },
      });
      await app.close();
      return res.json() as {
        access_token: string;
        account_id: string;
        personal_space_id: string;
      };
    }

    /** Trades `token` for a fresh one, as of `at`. */
    async function reissue(token: string | undefined, at: Date) {
      const app = buildServer({ ...deps, now: () => at });
      const res = await app.inject({
        method: "POST",
        url: "/auth/token",
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
      });
      await app.close();
      return res;
    }

    const signedInAt = new Date("2026-07-19T12:00:00.000Z");
    const later = (seconds: number) =>
      new Date(signedInAt.getTime() + seconds * 1000);

    it("mints a fresh PowerSync-verifiable token for the held one", async () => {
      const session = await register(signedInAt);
      const res = await reissue(session.access_token, later(60));
      expect(res.statusCode).toBe(200);

      const body = res.json() as {
        access_token: string;
        token_type: string;
        expires_in: number;
        account_id: string;
        personal_space_id: string;
      };
      expect(body.token_type).toBe("Bearer");
      expect(body.expires_in).toBe(deps.tokenTtlSeconds);
      expect(body.account_id).toBe(session.account_id);
      expect(body.personal_space_id).toBe(session.personal_space_id);

      const jwks = createLocalJWKSet({ keys: [deps.signingKey.jwk] });
      const { payload } = await jwtVerify(body.access_token, jwks, {
        issuer: ISSUER,
        audience: AUDIENCE,
        currentDate: later(60),
      });
      expect(payload.sub).toBe(session.account_id);
      expect(payload.personal_space_id).toBe(session.personal_space_id);
      // The point of the endpoint: the new token outlives the old one.
      expect(payload.exp).toBe(Math.floor(later(60).getTime() / 1000) + 900);
    });

    // The bug this ticket fixes: sync used to die once the held token expired.
    it("re-issues from a token whose exp has already passed", async () => {
      const session = await register(signedInAt);
      const res = await reissue(session.access_token, later(48 * HOUR));
      expect(res.statusCode).toBe(200);
    });

    it("401s once the session is older than the max age", async () => {
      const session = await register(signedInAt);
      const res = await reissue(session.access_token, later(SESSION_MAX_AGE + 1));
      expect(res.statusCode).toBe(401);
      expect((res.json() as { error: string }).error).toBe("session_expired");
    });

    it("401s without a bearer token, and on a token it did not sign", async () => {
      expect((await reissue(undefined, signedInAt)).statusCode).toBe(401);
      expect((await reissue("not-a-jwt", signedInAt)).statusCode).toBe(401);
    });

    it("401s when the Account behind the token no longer exists", async () => {
      const session = await register(signedInAt);
      (deps.repo as InMemoryAuthRepo).accounts.delete(session.account_id);
      const res = await reissue(session.access_token, later(60));
      expect(res.statusCode).toBe(401);
    });
  });
});
