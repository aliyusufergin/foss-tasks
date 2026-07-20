import { v4 as uuidv4 } from "uuid";

/**
 * Client-generated primary keys (ADR-0005 §1). Every record's id is minted on
 * the Device so offline creates get a stable, final id that never changes on
 * sync. UUID v4 keeps the keyspace collision-free across Devices without
 * coordination.
 */
export function newId(): string {
  return uuidv4();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for a canonical RFC-4122 UUID string. */
export function isValidId(value: string): boolean {
  return UUID_RE.test(value);
}
