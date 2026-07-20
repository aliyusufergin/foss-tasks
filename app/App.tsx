import { PowerSyncContext } from "@powersync/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { AuthClient, type Session } from "./src/auth/client.js";
import { type SecureKeyValueStore, TokenStore } from "./src/auth/token-store.js";
import { config } from "./src/config.js";
import { System } from "./src/data/system.js";
import { SignInScreen } from "./src/ui/SignInScreen.js";
import { TaskListScreen } from "./src/ui/TaskListScreen.js";

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
  const [session, setSession] = useState<Session | null>(null);
  const systemRef = useRef<System | null>(null);

  const system = useMemo(() => {
    const s = new System({ powerSyncUrl: config.powerSyncUrl, tokenStore });
    systemRef.current = s;
    return s;
  }, []);

  useEffect(() => {
    void (async () => {
      await system.init();
      const held = await tokenStore.load();
      if (held) {
        setSession(held);
        await system.connect();
      }
      setReady(true);
    })();
  }, [system]);

  async function onSignedIn(next: Session): Promise<void> {
    await tokenStore.save(next);
    setSession(next);
    await system.connect();
  }

  async function onSignOut(): Promise<void> {
    await system.disconnect();
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

  if (session === null) {
    return <SignInScreen authClient={authClient} onSignedIn={(s) => void onSignedIn(s)} />;
  }

  return (
    <PowerSyncContext.Provider value={system.powersync}>
      <TaskListScreen spaceId={session.personalSpaceId} onSignOut={() => void onSignOut()} />
    </PowerSyncContext.Provider>
  );
}
