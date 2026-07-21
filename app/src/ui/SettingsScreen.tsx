import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useLanguageControl } from "../i18n/LanguageProvider";
import type { LanguagePreference } from "../prefs/language-preference";
import type { ThemeMode } from "../prefs/theme-preference";
import { Box, Text, useTheme } from "../theme/components";
import { useThemeControl } from "../theme/ThemeProvider";
import { Button } from "./components/Button";

interface Option<T extends string> {
  value: T;
  label: string;
}

/** A row of mutually-exclusive pills; the selected one is accent-tinted. */
function Segmented<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
}): JSX.Element {
  const theme = useTheme();
  return (
    <Box flexDirection="row" gap="sm" flexWrap="wrap">
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <Pressable key={opt.value} onPress={() => onSelect(opt.value)} accessibilityRole="button">
            <Box
              paddingVertical="sm"
              paddingHorizontal="lg"
              borderRadius="pill"
              backgroundColor={active ? "accent.surface" : "bg.subtle"}
            >
              <Text
                variant="label"
                style={{
                  color: active ? theme.colors["accent.default"] : theme.colors["text.secondary"],
                }}
              >
                {opt.label}
              </Text>
            </Box>
          </Pressable>
        );
      })}
    </Box>
  );
}

interface Props {
  onSignOut: () => void;
}

/** Device-local settings: theme (light/dark/system) and language (TR/EN/system),
 *  both switching at runtime, plus sign-out. Fully themed and localised (#4). */
export function SettingsScreen({ onSignOut }: Props): JSX.Element {
  const { t } = useTranslation();
  const { mode, setMode } = useThemeControl();
  const { pref, setPref } = useLanguageControl();

  const themeOptions: Option<ThemeMode>[] = [
    { value: "system", label: t("settings.themeSystem") },
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
  ];
  const languageOptions: Option<LanguagePreference>[] = [
    { value: "system", label: t("settings.languageSystem") },
    { value: "en", label: t("settings.languageEnglish") },
    { value: "tr", label: t("settings.languageTurkish") },
  ];

  return (
    <Box flex={1} backgroundColor="bg.base" padding="lg" gap="xl">
      <Box gap="md">
        <Text variant="label" color="text.muted">
          {t("settings.theme")}
        </Text>
        <Segmented options={themeOptions} selected={mode} onSelect={setMode} />
      </Box>

      <Box gap="md">
        <Text variant="label" color="text.muted">
          {t("settings.language")}
        </Text>
        <Segmented options={languageOptions} selected={pref} onSelect={setPref} />
      </Box>

      <Box marginTop="xl">
        <Button label={t("common.signOut")} variant="secondary" onPress={onSignOut} />
      </Box>
    </Box>
  );
}
