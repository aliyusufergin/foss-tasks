/**
 * Device-local key-value preferences (CONTEXT.md § Preferences: "Device-local —
 * per-Device settings that are not synced, e.g. chosen Theme"). Backed on-device
 * by the OS store; written against a narrow port so it is testable with an
 * in-memory double and so the backend can change without touching callers.
 */
export interface DeviceKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * A preference whose value is one of a fixed set of strings. Reads fall back to
 * the default on a first run or a corrupt/unknown stored value, so a bad write
 * can never wedge the app into an invalid state.
 */
export class EnumPreferenceStore<T extends string> {
  constructor(
    private readonly store: DeviceKeyValueStore,
    private readonly key: string,
    private readonly valid: readonly T[],
    private readonly fallback: T,
  ) {}

  async load(): Promise<T> {
    const raw = await this.store.getItem(this.key);
    return raw !== null && (this.valid as readonly string[]).includes(raw) ? (raw as T) : this.fallback;
  }

  async save(value: T): Promise<void> {
    await this.store.setItem(this.key, value);
  }
}
