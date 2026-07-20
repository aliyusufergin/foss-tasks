import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/react-native";
import type { AuthClient } from "../auth/client";
import type { TokenStore } from "../auth/token-store";

/**
 * What both the {@link AppConnector} and the `System` that owns it need: where
 * the Server is, and how to obtain a live JWT. One type rather than two
 * identical ones, since `System` forwards its config straight through to the
 * connector.
 */
export interface SyncConfig {
  /** PowerSync Service URL, e.g. `http://10.0.2.2:8080`. */
  powerSyncUrl: string;
  tokenStore: TokenStore;
  /** Used to trade the held token for a fresh one on every credential fetch. */
  authClient: AuthClient;
  /**
   * Called when the held session is past saving and the user has to sign in
   * again. The app root uses it to drop back to the sign-in screen. It is
   * invoked synchronously, so the handler must not block — kick off anything
   * slow (like clearing the local replica) without awaiting it here.
   */
  onSessionExpired?: () => void;
}

/**
 * Wires the app's auth to PowerSync. `fetchCredentials` hands PowerSync the held
 * JWT (its `sub` is the Account id, which the sync rules turn into
 * membership-scoped buckets), which is what drives downstream live streaming.
 */
export class AppConnector implements PowerSyncBackendConnector {
  constructor(private readonly config: SyncConfig) {}

  /**
   * Mints a **fresh** token on every call, which is what the interface actually
   * asks for — PowerSync calls this on connect, ~30s before expiry, on expiry,
   * on an HTTP 401, and on a WebSocket `PSYNC_S21`, and all five route through
   * `invalidateCredentials()`. Handing back a stored token means the answer
   * never changes, so an expired one puts the client in a fixed 5s retry loop
   * forever (`DEFAULT_RETRY_DELAY_MS` — not exponential backoff).
   *
   * The two failure modes are distinct and the JSDoc on the interface is
   * explicit about which is which:
   *
   * - **`null` means signed out.** Only a `401` from the re-issue endpoint earns
   *   this, i.e. the session is past its max age. The held token is cleared and
   *   the app is told to show sign-in.
   * - **Throwing means try again.** Network failure or a server-side error is
   *   transient; the held token stays put and the retry loop handles it.
   *
   * Getting that backwards would either sign people out on a flaky connection
   * or spin forever on a session that is genuinely over.
   *
   * Note the failure surfaces on `SyncStatus.downloadError`, not `uploadError`.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const held = await this.config.tokenStore.load();
    if (held === null) return null;

    const result = await this.config.authClient.refresh(held.accessToken);

    if (!result.ok) {
      if (result.error !== "session_expired") {
        throw new Error(`[sync] could not refresh credentials: ${result.error}`);
      }
      await this.config.tokenStore.clear();
      this.config.onSessionExpired?.();
      return null;
    }

    await this.config.tokenStore.save(result.session);
    return {
      endpoint: this.config.powerSyncUrl,
      token: result.session.accessToken,
    };
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
