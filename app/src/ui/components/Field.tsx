import { TextInput, type TextInputProps } from "react-native";
import { Box, Text, useTheme } from "../../theme/components";

interface Props extends Omit<TextInputProps, "style"> {
  label: string;
}

/** A labelled text input. The caption label + hairline-bordered input follow the
 *  auth layout notes; every colour is a theme token. */
export function Field({ label, ...input }: Props): JSX.Element {
  const theme = useTheme();
  return (
    <Box gap="xs">
      <Text variant="caption" color="text.muted" style={{ letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Box
        backgroundColor="bg.surface"
        borderWidth={1}
        borderColor="border.default"
        borderRadius="md"
        paddingHorizontal="md"
      >
        <TextInput
          {...input}
          placeholderTextColor={theme.colors["text.muted"]}
          style={{
            color: theme.colors["text.primary"],
            paddingVertical: theme.spacing.md,
            fontSize: theme.textVariants.body.fontSize,
          }}
        />
      </Box>
    </Box>
  );
}
