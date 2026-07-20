import { useQuery, useStatus } from "@powersync/react";
import { Button, FlatList, StyleSheet, Text, View } from "react-native";
import type { TaskRow } from "../data/queries";
import { ACTIVE_TASKS_SQL } from "../data/queries";

/** Alert red for sync failure states, shared until ADR-0006 theming lands. */
const DANGER = "#b00020";

interface Props {
  spaceId: string;
  onSignOut: () => void;
}

/**
 * The walking-skeleton task list: a live query over the on-device PowerSync
 * store, scoped to the Personal Space, tombstones hidden, in fractional-index
 * order. Rows appear as the Server streams them, which is what this ticket sets
 * out to prove.
 *
 * **Read-only by design.** v1 has no backend write endpoint, and PowerSync gives
 * a client no supported download-only mode: a local write would sit in the CRUD
 * queue, and acknowledging it without uploading silently destroys it on the next
 * checkpoint (see docs/research/powersync-client-contracts-2026-07.md). Rather
 * than offer a control that loses data, the app offers no local writes until the
 * write path exists. Creating and editing Tasks lands with that ticket.
 */
export function TaskListScreen({ spaceId, onSignOut }: Props): JSX.Element {
  const status = useStatus();
  const { data: tasks } = useQuery<TaskRow>(ACTIVE_TASKS_SQL, [spaceId]);

  // downloadError is where an expired/rejected token surfaces — not uploadError.
  // A UI watching only uploadError would show a cheerful "offline" while sync
  // was in fact dead.
  const { downloadError, uploadError } = status.dataFlowStatus;
  const error = downloadError ?? uploadError;

  // "offline" and "sync is failing" look identical to a user but mean opposite
  // things: one resolves itself when the tunnel comes back, the other does not.
  const stalled = downloadError !== undefined && !status.connected;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.status, stalled && styles.statusStalled]}>
          {stalled ? "▲ sync stopped" : status.connected ? "● live" : "○ offline"}
        </Text>
        <Button title="Sign out" onPress={onSignOut} />
      </View>

      {error !== undefined && <Text style={styles.error}>sync error: {error.message}</Text>}

      <Text style={styles.note}>
        Read-only until the write path ships — Tasks stream in from the Server.
      </Text>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowMeta}>{item.status}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No tasks yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  status: { fontSize: 14, color: "#555" },
  // Same alert red as `error` below. Theming (ADR-0006) isn't wired into this
  // skeleton screen yet; when it is, both read one token.
  statusStalled: { color: DANGER, fontWeight: "600" },
  note: { fontSize: 12, color: "#888" },
  error: { fontSize: 12, color: DANGER },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  rowTitle: { fontSize: 16 },
  rowMeta: { fontSize: 12, color: "#999" },
  empty: { textAlign: "center", color: "#999", marginTop: 24 },
});
