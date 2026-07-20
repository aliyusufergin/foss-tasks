import { PowerSyncContext } from "@powersync/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { AuthClient, type Session } from "./src/auth/client";
import { type SecureKeyValueStore, TokenStore } from "./src/auth/token-store";
import { config } from "./src/config";
import { System } from "./src/data/system";
import { SignInScreen } from "./src/ui/SignInScreen";
import { TaskListScreen } from "./src/ui/TaskListScreen";

// Adapt Expo SecureStore's *Async API to the store port.
const secureStore: SecureKeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const tokenStore = new TokenStore(secureStore);
const authClient = new AuthClient({ baseUrl: config.authUrl });

/**
 * App root: restores any held session on launch (stay-signed-in), then wires the
 * PowerSync System and streams live once authenticated. Signing out disconnects
 * and clears local data.
 */
export default function App(): JSX.Element {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<Error | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const systemRef = useRef<System | null>(null);

  const system = useMemo(() => {
    const s = new System({
      powerSyncUrl: config.powerSyncUrl,
      tokenStore,
      authClient,
      // The session outlived its max age while the app was running. Treat it
      // exactly like a sign-out — the local replica goes too, so the next
      // Account on this Device cannot see this one's data — and send the user
      // back to sign-in. Not awaited: the connector calls this synchronously.
      onSessionExpired: () => {
        console.warn("[sync] session expired; signing out");
        setSession(null);
        void s.signOutAndClear().catch((err: unknown) => {
          console.error("[sync] failed to clear local data after expiry", err);
        });
      },
    });
    systemRef.current = s;
    return s;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        console.log("[boot] opening local database…");
        await system.init();
        console.log("[boot] database ready, restoring session…");
        const held = await tokenStore.load();
        if (held) {
          setSession(held);
          console.log("[boot] session restored, connecting to sync…");
          await system.connect();
        }
        console.log("[boot] ready");
      } catch (err) {
        // Without this the promise rejects unobserved and the app sits on the
        // spinner forever with nothing on screen to explain why.
        console.error("[boot] startup failed", err);
        setBootError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setReady(true);
      }
    })();
  }, [system]);

  async function onSignedIn(next: Session): Promise<void> {
    await tokenStore.save(next);
    setSession(next);
    await system.connect();
  }

  async function onSignOut(): Promise<void> {
    await system.signOutAndClear();
    await tokenStore.clear();
    setSession(null);
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (bootError !== null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Couldn&apos;t start</Text>
        <Text selectable>{bootError.message}</Text>
      </View>
    );
  }

  if (session === null) {
    return <SignInScreen authClient={authClient} onSignedIn={(s) => void onSignedIn(s)} />;
  }

  return (
    <PowerSyncContext.Provider value={system.powersync}>
      <TaskListScreen spaceId={session.personalSpaceId} onSignOut={() => void onSignOut()} />
    </PowerSyncContext.Provider>
  );
}
