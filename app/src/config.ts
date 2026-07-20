import { Platform } from "react-native";

/**
 * Server endpoints. Defaults target a self-hosted stack running on the dev
 * machine: Android emulators reach the host at 10.0.2.2, iOS simulators at
 * localhost. Override per build with EXPO_PUBLIC_* env vars pointing at a real
 * Server (ports match `.env.example`: auth 6060, PowerSync 8080).
 */
const host = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const config = {
  authUrl: process.env.EXPO_PUBLIC_AUTH_URL ?? `http://${host}:6060`,
  powerSyncUrl: process.env.EXPO_PUBLIC_POWERSYNC_URL ?? `http://${host}:8080`,
};
