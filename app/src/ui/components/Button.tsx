import { Pressable } from "react-native";
import { Box, Text, useTheme } from "../../theme/components";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

/** Token-driven button (Restyle has no button primitive). Primary is an accent
 *  fill; secondary is a bordered surface. Colours come only from the theme. */
export function Button({ label, onPress, variant = "primary", disabled = false }: Props): JSX.Element {
  const theme = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 })}
      accessibilityRole="button"
    >
      <Box
        paddingVertical="md"
        paddingHorizontal="lg"
        borderRadius="lg"
        alignItems="center"
        backgroundColor={primary ? "accent.default" : "bg.surface"}
        borderWidth={primary ? 0 : 1}
        borderColor="border.default"
      >
        <Text
          variant="label"
          style={{ color: primary ? theme.colors["accent.on"] : theme.colors["text.primary"] }}
        >
          {label}
        </Text>
      </Box>
    </Pressable>
  );
}
