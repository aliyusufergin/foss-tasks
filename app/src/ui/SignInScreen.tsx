import { useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";
import type { AuthClient, Session } from "../auth/client.js";

interface Props {
  authClient: AuthClient;
  onSignedIn: (session: Session) => void;
}

/**
 * Minimal email + password sign-in / register (auth is deliberately minimal in
 * v1 — no OAuth/2FA/reset). On success the held {@link Session} is handed up so
 * the app can connect to sync. This screen is intentionally unstyled scaffolding
 * — the themed design (Ink & Signal) lands with the UI tickets.
 */
export function SignInScreen({ authClient, onSignedIn }: Props): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(mode: "login" | "register"): Promise<void> {
    setBusy(true);
    setError(null);
    const result =
      mode === "login"
        ? await authClient.login({ email, password })
        : await authClient.register({ email, password });
    setBusy(false);
    if (result.ok) onSignedIn(result.session);
    else setError(result.error);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>foss-tasks</Text>
      <TextInput
        style={styles.input}
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {busy ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.actions}>
          <Button title="Sign in" onPress={() => void submit("login")} />
          <Button title="Register" onPress={() => void submit("register")} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  actions: { flexDirection: "row", justifyContent: "space-around" },
  error: { color: "#b00020" },
});
