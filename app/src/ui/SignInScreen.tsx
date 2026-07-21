import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import type { AuthClient, Session } from "../auth/client";
import { Box, Text, useTheme } from "../theme/components";
import { Button } from "./components/Button";
import { Field } from "./components/Field";

interface Props {
  authClient: AuthClient;
  onSignedIn: (session: Session) => void;
}

/**
 * Email + password sign-in / register (auth is deliberately minimal in v1 — no
 * OAuth/2FA/reset). Themed via Restyle and localised via i18n; the T02 hardcoded
 * strings and hex are gone (this ticket, #4). On success the held {@link Session}
 * is handed up so the app can connect to sync.
 */
export function SignInScreen({ authClient, onSignedIn }: Props): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
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
    <Box flex={1} backgroundColor="bg.base">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Box flex={1} justifyContent="center" padding="xl" gap="lg">
          <Box
            width={56}
            height={56}
            borderRadius="xl"
            backgroundColor="accent.default"
            alignItems="center"
            justifyContent="center"
            alignSelf="center"
          >
            <Text variant="display" style={{ color: theme.colors["accent.on"] }}>
              ✓
            </Text>
          </Box>
          <Text variant="display" textAlign="center" color="text.primary">
            {t("common.appName")}
          </Text>

          <Field
            label={t("auth.emailLabel")}
            placeholder={t("auth.emailPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label={t("auth.passwordLabel")}
            placeholder={t("auth.passwordPlaceholder")}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error !== null && (
            <Text variant="label" color="status.overdue">
              {error}
            </Text>
          )}

          {busy ? (
            <ActivityIndicator color={theme.colors["accent.default"]} />
          ) : (
            <Button
              label={mode === "login" ? t("auth.signIn") : t("auth.register")}
              onPress={() => void submit()}
            />
          )}

          <Text
            variant="label"
            textAlign="center"
            color="accent.default"
            onPress={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? t("auth.switchToRegister") : t("auth.switchToSignIn")}
          </Text>
        </Box>
      </KeyboardAvoidingView>
    </Box>
  );
}
