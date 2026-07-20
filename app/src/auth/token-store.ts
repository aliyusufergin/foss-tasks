import { isSession, type Session } from "./session";

/**
 * Persists the held {@link Session} so a returning user stays signed in across
 * app launches (user story 3). The JWT is device-local secret material, so
 * production backs this with the OS keystore (`expo-secure-store`); the store is
 * written against a narrow port so it is testable with an in-memory double and
 * so the storage backend can change without touching callers.
 */
export interface SecureKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const SESSION_KEY = "foss-tasks.session";

export class TokenStore {
  constructor(private readonly store: SecureKeyValueStore) {}

  async save(session: Session): Promise<void> {
    await this.store.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async load(): Promise<Session | null> {
    const raw = await this.store.getItem(SESSION_KEY);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      // Corrupt or stale-shape payload: treat as signed-out rather than
      // letting a malformed Session flow into sync.
      return isSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.store.removeItem(SESSION_KEY);
  }
}
