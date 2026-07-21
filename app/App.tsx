import { PowerSyncContext } from "@powersync/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { AuthClient, type Session } from "./src/auth/client";
import { type SecureKeyValueStore, TokenStore } from "./src/auth/token-store";
import { config } from "./src/config";
import { System } from "./src/data/system";
import { LanguageProvider } from "./src/i18n/LanguageProvider";
import { initI18n } from "./src/i18n";
import { LanguagePreferenceStore } from "./src/prefs/language-preference";
import { ThemePreferenceStore } from "./src/prefs/theme-preference";
import { AppThemeProvider } from "./src/theme/ThemeProvider";
import { Box, Text } from "./src/theme/components";
import { RootNavigator } from "./src/ui/RootNavigator";
import { SignInScreen } from "./src/ui/SignInScreen";

// Adapt Expo SecureStore's *Async API to the store port. The token store needs
// the OS keystore (secret material); the preference stores only need a
// device-local key-value backend, and reuse the same adapter (ADR-0006 note).
const secureStore: SecureKeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const tokenStore = new TokenStore(secureStore);
const themePrefStore = new ThemePreferenceStore(secureStore);
const languagePrefStore = new LanguagePreferenceStore(secureStore);
const authClient = new AuthClient({ baseUrl: config.authUrl });

// Seed i18next synchronously (inline resources) so the first render is localised;
// LanguageProvider reconciles the stored preference once mounted.
initI18n();

/**
 * App root: restores any held session on launch (stay-signed-in), then wires the
 * PowerSync System and streams live once authenticated. Signing out disconnects
 * and clears local data. The whole tree sits under the theme + language providers
 * (#4) so every screen is themed and localised.
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

  return (
    <SafeAreaProvider>
      <AppThemeProvider store={themePrefStore}>
        <LanguageProvider store={languagePrefStore}>
          <AppContent
            ready={ready}
            bootError={bootError}
            session={session}
            system={system}
            onSignedIn={(s) => void onSignedIn(s)}
            onSignOut={() => void onSignOut()}
          />
        </LanguageProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

interface ContentProps {
  ready: boolean;
  bootError: Error | null;
  session: Session | null;
  system: System;
  onSignedIn: (session: Session) => void;
  onSignOut: () => void;
}

/** Split out so it renders *inside* the theme + language providers and can read
 *  tokens and localised strings. */
function AppContent({
  ready,
  bootError,
  session,
  system,
  onSignedIn,
  onSignOut,
}: ContentProps): JSX.Element {
  const { t } = useTranslation();

  if (!ready) {
    return (
      <Box flex={1} justifyContent="center" backgroundColor="bg.base">
        <ActivityIndicator />
      </Box>
    );
  }

  if (bootError !== null) {
    return (
      <Box flex={1} justifyContent="center" padding="xl" gap="sm" backgroundColor="bg.base">
        <Text variant="title" color="text.primary">
          {t("common.bootError")}
        </Text>
        <Text variant="body" color="text.secondary" selectable>
          {bootError.message}
        </Text>
      </Box>
    );
  }

  if (session === null) {
    return <SignInScreen authClient={authClient} onSignedIn={onSignedIn} />;
  }

  return (
    <PowerSyncContext.Provider value={system.powersync}>
      <RootNavigator spaceId={session.personalSpaceId} onSignOut={onSignOut} />
    </PowerSyncContext.Provider>
  );
}
