import { useQuery, useStatus } from "@powersync/react";
import { useState } from "react";
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { usePowerSync } from "@powersync/react";
import { newId } from "../domain/ids.js";
import { orderKeyAfter } from "../domain/order-key.js";
import type { TaskRow } from "../data/queries.js";
import { ACTIVE_TASKS_SQL, insertTask, softDeleteTask } from "../data/queries.js";

interface Props {
  spaceId: string;
  onSignOut: () => void;
}

/**
 * The walking-skeleton task list: live query over the on-device PowerSync store,
 * scoped to the Personal Space, tombstones hidden, in fractional-index order.
 * Proves foreground live streaming (rows appear as the Server syncs them) and
 * exercises the offline-first foundations end-to-end through the data seam.
 */
export function TaskListScreen({ spaceId, onSignOut }: Props): JSX.Element {
  const db = usePowerSync();
  const status = useStatus();
  const [title, setTitle] = useState("");

  const { data: tasks } = useQuery<TaskRow>(ACTIVE_TASKS_SQL, [spaceId]);

  async function add(): Promise<void> {
    if (title.trim() === "") return;
    const last = tasks.at(-1)?.order_key ?? null;
    const now = new Date().toISOString();
    await insertTask(db, {
      id: newId(),
      space_id: spaceId,
      title: title.trim(),
      status: "open",
      order_key: orderKeyAfter(last),
      created_at: now,
      updated_at: now,
    });
    setTitle("");
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.status}>{status.connected ? "● live" : "○ offline"}</Text>
        <Button title="Sign out" onPress={onSignOut} />
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="New task"
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={() => void add()}
        />
        <Button title="Add" onPress={() => void add()} />
      </View>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Button
              title="Delete"
              onPress={() => void softDeleteTask(db, item.id, new Date().toISOString())}
            />
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
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  rowTitle: { fontSize: 16 },
  empty: { textAlign: "center", color: "#999", marginTop: 24 },
});
