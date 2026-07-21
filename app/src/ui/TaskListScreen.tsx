import { useQuery, useStatus } from "@powersync/react";
import { FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import type { TaskRow } from "../data/queries";
import { ACTIVE_TASKS_SQL } from "../data/queries";
import { Box, Text, useTheme } from "../theme/components";

interface Props {
  spaceId: string;
}

/**
 * The walking-skeleton task list: a live query over the on-device PowerSync
 * store, scoped to the Personal Space, tombstones hidden, in fractional-index
 * order. Themed via Restyle and localised via i18n (#4).
 *
 * **Read-only by design.** v1 has no backend write endpoint yet; creating and
 * editing Tasks lands with the write-path ticket. See the T02 note in git
 * history for the PowerSync CRUD-queue reasoning.
 */
export function TaskListScreen({ spaceId }: Props): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const status = useStatus();
  const { data: tasks } = useQuery<TaskRow>(ACTIVE_TASKS_SQL, [spaceId]);

  // downloadError is where an expired/rejected token surfaces — not uploadError.
  const { downloadError, uploadError } = status.dataFlowStatus;
  const error = downloadError ?? uploadError;

  // "offline" and "sync is failing" look identical to a user but mean opposite
  // things: one resolves itself when the tunnel comes back, the other does not.
  const stalled = downloadError !== undefined && !status.connected;
  const statusLabel = stalled
    ? `▲ ${t("tasks.statusStopped")}`
    : status.connected
      ? `● ${t("tasks.statusLive")}`
      : `○ ${t("tasks.statusOffline")}`;

  return (
    <Box flex={1} backgroundColor="bg.base" paddingHorizontal="lg" gap="md">
      <Text variant="caption" color={stalled ? "status.overdue" : "text.muted"}>
        {statusLabel}
      </Text>

      {error !== undefined && (
        <Text variant="caption" color="status.overdue">
          {t("tasks.syncError", { message: error.message })}
        </Text>
      )}

      <Text variant="caption" color="text.muted">
        {t("tasks.readOnlyNote")}
      </Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: theme.spacing.sm }}
        renderItem={({ item }) => (
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            backgroundColor="bg.surface"
            borderRadius="md"
            paddingVertical="md"
            paddingHorizontal="md"
          >
            <Text variant="body" color="text.primary">
              {item.title}
            </Text>
            <Text variant="caption" color="text.muted">
              {item.status}
            </Text>
          </Box>
        )}
        ListEmptyComponent={
          <Box alignItems="center" marginTop="xxl" gap="sm">
            <Text variant="title" color="text.primary">
              {t("tasks.empty")}
            </Text>
            <Text variant="body" color="text.secondary">
              {t("tasks.emptyHint")}
            </Text>
          </Box>
        }
      />
    </Box>
  );
}
