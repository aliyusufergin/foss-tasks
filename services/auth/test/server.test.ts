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

async function makeDeps(): Promise<ServerDeps> {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  const signingKey = await loadSigningKey(await exportPKCS8(privateKey), "kid-1");
  return {
    repo: new InMemoryAuthRepo(),
    signingKey,
    issuer: ISSUER,
    audience: AUDIENCE,
    tokenTtlSeconds: 3600,
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
});
