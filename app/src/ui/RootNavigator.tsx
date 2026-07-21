import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Text, useTheme } from "../theme/components";
import { useThemeControl } from "../theme/ThemeProvider";
import { toNavTheme } from "./nav-theme";
import { SettingsScreen } from "./SettingsScreen";
import { TaskListScreen } from "./TaskListScreen";

const Tab = createBottomTabNavigator();
const TodayStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

interface Props {
  spaceId: string;
  onSignOut: () => void;
}

/**
 * The themed, localised navigation shell (#4): a bottom-tab shell with a native
 * stack per tab. The whole tree is themed from the Restyle tokens (via
 * {@link toNavTheme}) and every visible label goes through i18n, so the shell
 * re-themes and re-localises at runtime with the rest of the app.
 */
export function RootNavigator({ spaceId, onSignOut }: Props): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { resolved } = useThemeControl();

  return (
    <NavigationContainer theme={toNavTheme(theme, resolved === "dark")}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors["accent.default"],
          tabBarInactiveTintColor: theme.colors["text.muted"],
          tabBarStyle: {
            backgroundColor: theme.colors["bg.surface"],
            borderTopColor: theme.colors["border.default"],
          },
        }}
      >
        <Tab.Screen
          name="TodayTab"
          options={{
            tabBarLabel: t("tabs.today"),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◎</Text>,
          }}
        >
          {() => (
            <TodayStack.Navigator>
              <TodayStack.Screen name="Today" options={{ title: t("tasks.title") }}>
                {() => <TaskListScreen spaceId={spaceId} />}
              </TodayStack.Screen>
            </TodayStack.Navigator>
          )}
        </Tab.Screen>

        <Tab.Screen
          name="SettingsTab"
          options={{
            tabBarLabel: t("tabs.settings"),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⚙</Text>,
          }}
        >
          {() => (
            <SettingsStack.Navigator>
              <SettingsStack.Screen name="Settings" options={{ title: t("settings.title") }}>
                {() => <SettingsScreen onSignOut={onSignOut} />}
              </SettingsStack.Screen>
            </SettingsStack.Navigator>
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
