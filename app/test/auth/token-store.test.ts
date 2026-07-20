import { describe, expect, it } from "vitest";
import type { Session } from "../../src/auth/client.js";
import { type SecureKeyValueStore, TokenStore } from "../../src/auth/token-store.js";

class MemoryStore implements SecureKeyValueStore {
  private readonly map = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }
}

const session: Session = {
  accessToken: "jwt",
  tokenType: "Bearer",
  expiresIn: 3600,
  accountId: "acc-1",
  personalSpaceId: "space-1",
};

describe("TokenStore", () => {
  it("round-trips a saved session (stay signed in across launches)", async () => {
    const store = new TokenStore(new MemoryStore());
    expect(await store.load()).toBeNull();
    await store.save(session);
    expect(await store.load()).toEqual(session);
  });

  it("clear signs the user out", async () => {
    const store = new TokenStore(new MemoryStore());
    await store.save(session);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("treats a corrupt payload as signed-out instead of throwing", async () => {
    const backing = new MemoryStore();
    await backing.setItem("foss-tasks.session", "{not json");
    const store = new TokenStore(backing);
    expect(await store.load()).toBeNull();
  });

  it("rejects valid JSON that isn't a Session (stale shape)", async () => {
    const backing = new MemoryStore();
    await backing.setItem("foss-tasks.session", JSON.stringify({ accessToken: 42 }));
    const store = new TokenStore(backing);
    expect(await store.load()).toBeNull();
  });
});
