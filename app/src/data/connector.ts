import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/react-native";
import type { TokenStore } from "../auth/token-store";

/**
 * What both the {@link AppConnector} and the `System` that owns it need: where
 * the Server is, and the held JWT. One type rather than two identical ones,
 * since `System` forwards its config straight through to the connector.
 */
export interface SyncConfig {
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
  constructor(private readonly config: SyncConfig) {}

  /**
   * KNOWN GAP: this returns the *stored* token, but the interface contract is to
   * always fetch a **fresh** one — PowerSync calls this on connect, ~30s before
   * expiry, on expiry, on a 401, and on a WebSocket auth error. With a 1h TTL
   * and no re-issue endpoint on the auth service, sync therefore dies about an
   * hour after sign-in and retries every 5s forever. The fix is a token re-issue
   * endpoint that this method calls; tracked separately.
   *
   * Note the failure surfaces on `SyncStatus.downloadError`, not `uploadError`.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const session = await this.config.tokenStore.load();
    if (session === null) return null;
    return { endpoint: this.config.powerSyncUrl, token: session.accessToken };
  }

  /**
   * Drains the local write queue. v1 ships **no backend write endpoint** —
   * Postgres is the source of truth (ADR-0004) and the write path lands with a
   * later ticket — so there is nothing to upload to yet.
   *
   * This deliberately **throws** instead of calling `batch.complete()`.
   * Completing a batch without uploading is silent data loss: it sets
   * `$local.target_op = MAX_OP_ID`, the upload loop writes a real write-checkpoint
   * that does not contain the row, and the next checkpoint rebuilds the table
   * from `ps_oplog` without it — PowerSync's docs put it plainly, "those changes
   * will be removed from the client". Worse, that only happens *while connected*,
   * so an offline edit looks fine and vanishes on reconnect.
   *
   * Throwing keeps the write queued and surfaces the failure (5s retry,
   * `SyncStatus.uploadError` set) rather than losing it. Downloads stall while
   * the queue is blocked, which is the correct trade for not destroying user
   * data. The app therefore must not offer local writes until the endpoint
   * exists. See docs/research/powersync-client-contracts-2026-07.md.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const batch = await database.getCrudBatch();
    if (batch === null) return;

    throw new Error(
      `[sync] cannot upload ${batch.crud.length} local write(s): v1 has no write backend. ` +
        `Local writes must not be offered until one exists.`,
    );
  }
}
