import { describe, expect, it, vi } from "vitest";
import { AuthClient, type FetchLike } from "../../src/auth/client.js";

const TOKEN_BODY = {
  access_token: "jwt.abc.def",
  token_type: "Bearer",
  expires_in: 3600,
  account_id: "acc-1",
  personal_space_id: "space-1",
};

function fetchReturning(status: number, body: unknown): FetchLike {
  return vi.fn(async () => ({ status, json: async () => body }));
}

describe("AuthClient", () => {
  it("returns a Session on successful login", async () => {
    const fetch = fetchReturning(200, TOKEN_BODY);
    const client = new AuthClient({ baseUrl: "http://auth:6060", fetch });
    const result = await client.login({ email: "a@b.c", password: "pw" });
    expect(result).toEqual({
      ok: true,
      session: {
        accessToken: "jwt.abc.def",
        tokenType: "Bearer",
        expiresIn: 3600,
        accountId: "acc-1",
        personalSpaceId: "space-1",
      },
    });
  });

  it("POSTs credentials as JSON to the login endpoint", async () => {
    const fetch = fetchReturning(200, TOKEN_BODY);
    const client = new AuthClient({ baseUrl: "http://auth:6060/", fetch });
    await client.login({ email: "a@b.c", password: "pw" });
    expect(fetch).toHaveBeenCalledWith("http://auth:6060/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.c", password: "pw" }),
    });
  });

  it("maps 401 to invalid_credentials", async () => {
    const client = new AuthClient({ baseUrl: "http://x", fetch: fetchReturning(401, {}) });
    expect(await client.login({ email: "a@b.c", password: "x" })).toEqual({
      ok: false,
      error: "invalid_credentials",
    });
  });

  it("maps 409 on register to email_taken", async () => {
    const client = new AuthClient({ baseUrl: "http://x", fetch: fetchReturning(409, {}) });
    expect(await client.register({ email: "a@b.c", password: "x" })).toEqual({
      ok: false,
      error: "email_taken",
    });
  });

  it("accepts 201 Created from register", async () => {
    const client = new AuthClient({ baseUrl: "http://x", fetch: fetchReturning(201, TOKEN_BODY) });
    const result = await client.register({ email: "a@b.c", password: "pw" });
    expect(result.ok).toBe(true);
  });

  it("flags a malformed success body", async () => {
    const client = new AuthClient({
      baseUrl: "http://x",
      fetch: fetchReturning(200, { access_token: 123 }),
    });
    expect(await client.login({ email: "a@b.c", password: "x" })).toEqual({
      ok: false,
      error: "unexpected_response",
    });
  });
});
