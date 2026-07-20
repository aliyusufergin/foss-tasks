import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthClient, type FetchLike } from "../../src/auth/client";
import type { Session } from "../../src/auth/session";
import { TokenStore, type SecureKeyValueStore } from "../../src/auth/token-store";
import { AppConnector } from "../../src/data/connector";

const POWERSYNC_URL = "http://10.0.2.2:8080";

const HELD: Session = {
  accessToken: "held.jwt.token",
  tokenType: "Bearer",
  expiresIn: 900,
  accountId: "acc-1",
  personalSpaceId: "space-1",
};

const FRESH_BODY = {
  access_token: "fresh.jwt.token",
  token_type: "Bearer",
  expires_in: 900,
  account_id: "acc-1",
  personal_space_id: "space-1",
};

/** In-memory {@link SecureKeyValueStore} standing in for the OS keystore. */
class MemoryStore implements SecureKeyValueStore {
  private readonly entries = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

describe("AppConnector.fetchCredentials", () => {
  let tokenStore: TokenStore;

  beforeEach(async () => {
    tokenStore = new TokenStore(new MemoryStore());
    await tokenStore.save(HELD);
  });

  function connectorWith(fetch: FetchLike, onSessionExpired = vi.fn()) {
    return new AppConnector({
      powerSyncUrl: POWERSYNC_URL,
      tokenStore,
      authClient: new AuthClient({ baseUrl: "http://10.0.2.2:6060", fetch }),
      onSessionExpired,
    });
  }

  function fetchReturning(status: number, body: unknown): FetchLike {
    return vi.fn(async () => ({ status, json: async () => body }));
  }

  it("returns a freshly minted token, not the stored one", async () => {
    const fetch = fetchReturning(200, FRESH_BODY);
    const credentials = await connectorWith(fetch).fetchCredentials();

    expect(credentials).toEqual({
      endpoint: POWERSYNC_URL,
      token: "fresh.jwt.token",
    });
    expect(fetch).toHaveBeenCalledWith("http://10.0.2.2:6060/auth/token", {
      method: "POST",
      headers: { authorization: "Bearer held.jwt.token" },
    });
  });

  it("persists the fresh session, so the next launch trades the newer token", async () => {
    await connectorWith(fetchReturning(200, FRESH_BODY)).fetchCredentials();
    expect(await tokenStore.load()).toEqual({ ...HELD, accessToken: "fresh.jwt.token" });
  });

  it("returns null when no session is held", async () => {
    await tokenStore.clear();
    const fetch = fetchReturning(200, FRESH_BODY);
    expect(await connectorWith(fetch).fetchCredentials()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  // PowerSync's contract: null means "signed out", throwing means "retry".
  it("returns null and clears the store once the session is genuinely dead", async () => {
    const onSessionExpired = vi.fn();
    const connector = connectorWith(fetchReturning(401, {}), onSessionExpired);

    expect(await connector.fetchCredentials()).toBeNull();
    expect(await tokenStore.load()).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("throws on a transient failure instead of signing the user out", async () => {
    const onSessionExpired = vi.fn();
    const connector = connectorWith(fetchReturning(503, {}), onSessionExpired);

    await expect(connector.fetchCredentials()).rejects.toThrow(/unexpected_response/);
    expect(await tokenStore.load()).toEqual(HELD);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("lets a network error propagate as a retryable failure", async () => {
    const offline: FetchLike = vi.fn(async () => {
      throw new Error("Network request failed");
    });
    const connector = connectorWith(offline);

    await expect(connector.fetchCredentials()).rejects.toThrow(/Network request failed/);
    expect(await tokenStore.load()).toEqual(HELD);
  });
});
