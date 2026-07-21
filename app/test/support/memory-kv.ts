import type { DeviceKeyValueStore } from "../../src/prefs/store";

/** In-memory {@link DeviceKeyValueStore} double for preference-store tests. */
export class MemoryKeyValueStore implements DeviceKeyValueStore {
  private map = new Map<string, string>();
  getItem = async (key: string): Promise<string | null> => this.map.get(key) ?? null;
  setItem = async (key: string, value: string): Promise<void> => void this.map.set(key, value);
  removeItem = async (key: string): Promise<void> => void this.map.delete(key);
}
