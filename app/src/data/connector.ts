import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/react-native";
import type { TokenStore } from "../auth/token-store.js";

export interface ConnectorConfig {
  /** PowerSync Service URL, e.g. `http://10.0.2.2:8080`. */
  powerSyncUrl: string;
  tokenStore: TokenStore;
}

/**
 * Wires the app's auth to PowerSync. `fetchCredentials` hands PowerSync the held
 * JWT (its `sub` is the Account id, which the sync rules turn into
 * membership-scoped buckets), which is what drives downstream live streaming.
 */
export class AppConnector implements PowerSyncBackendConnector {
  constructor(private readonly config: ConnectorConfig) {}

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const session = await this.config.tokenStore.load();
    if (session === null) return null;
    return { endpoint: this.config.powerSyncUrl, token: session.accessToken };
  }

  /**
   * Drains the local write queue. v1 ships **no backend write endpoint** —
   * Postgres is the source of truth (ADR-0004) and the write path lands with a
   * later ticket — so local writes are acknowledged without being uploaded.
   * Downstream streaming is unaffected; this only means Device-side edits do not
   * yet reach the Server. Replace this body with the real upload when the write
   * endpoint exists.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const batch = await database.getCrudBatch();
    if (batch === null) return;

    console.warn(
      `[sync] ${batch.crud.length} local write(s) not uploaded: no write backend in v1.`,
    );
    await batch.complete();
  }
}
