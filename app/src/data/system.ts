import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import { PowerSyncDatabase } from "@powersync/react-native";
import { AppConnector } from "./connector";
import { runMigrations } from "./migrations/runner";
import { AppSchema } from "./schema";
import type { TokenStore } from "../auth/token-store";

const DB_FILENAME = "foss-tasks.db";

export interface SystemConfig {
  powerSyncUrl: string;
  tokenStore: TokenStore;
}

/**
 * Opens the on-device PowerSync database (op-sqlite driver — the reason the app
 * runs as an Expo **dev client**, not Expo Go) and runs the device-local
 * forward migrations before first use. Call {@link System.connect} once a
 * session is held to start foreground live streaming against the Server.
 */
export class System {
  readonly powersync: PowerSyncDatabase;
  private readonly connector: AppConnector;

  constructor(config: SystemConfig) {
    this.powersync = new PowerSyncDatabase({
      schema: AppSchema,
      database: new OPSqliteOpenFactory({ dbFilename: DB_FILENAME }),
    });
    this.connector = new AppConnector(config);
  }

  /** Initialise the DB and apply device-local migrations (ADR-0005 §5). */
  async init(): Promise<void> {
    await this.powersync.init();
    await runMigrations(this.powersync);
  }

  /** Begin syncing with the Server using the held JWT. */
  async connect(): Promise<void> {
    await this.powersync.connect(this.connector);
  }

  /**
   * Sign-out: stop syncing AND wipe the local replica, so the next Account on
   * this Device never sees the previous one's data. This is destructive — it is
   * NOT a plain "pause syncing". For that, call `powersync.disconnect()`
   * directly, which leaves the local database intact.
   */
  async signOutAndClear(): Promise<void> {
    await this.powersync.disconnectAndClear();
  }
}
