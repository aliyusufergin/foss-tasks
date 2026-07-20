/**
 * The held Session and the single validator both ends of its lifecycle share.
 *
 * A Session crosses two boundaries with different shapes: it arrives from the
 * auth service in the wire payload's snake_case, and it is read back from the
 * secure store in the app's camelCase. Validating each independently meant the
 * same five-field check lived in two files, so adding a field could silently be
 * applied to one and forgotten in the other.
 *
 * Both derive from {@link SESSION_FIELDS} instead. It is typed
 * `Record<keyof Session, ...>`, so adding a field to `Session` without adding it
 * here is a compile error rather than a validator that quietly stops checking it.
 */

/** A held session: the JWT plus the identity claims the app needs. */
export interface Session {
  accessToken: string;
  tokenType: string;
  /** Seconds until the token expires (from issuance). */
  expiresIn: number;
  accountId: string;
  personalSpaceId: string;
}

/** Each Session field's runtime type and the wire key the auth service sends. */
const SESSION_FIELDS: Record<keyof Session, { type: "string" | "number"; wire: string }> = {
  accessToken: { type: "string", wire: "access_token" },
  tokenType: { type: "string", wire: "token_type" },
  expiresIn: { type: "number", wire: "expires_in" },
  accountId: { type: "string", wire: "account_id" },
  personalSpaceId: { type: "string", wire: "personal_space_id" },
};

const FIELD_NAMES = Object.keys(SESSION_FIELDS) as (keyof Session)[];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Whether a value read back from storage is a well-formed Session (camelCase).
 */
export function isSession(value: unknown): value is Session {
  const record = asRecord(value);
  if (record === null) return false;
  return FIELD_NAMES.every((name) => typeof record[name] === SESSION_FIELDS[name].type);
}

/**
 * Read the auth service's snake_case token payload into a Session, or `null` if
 * any field is missing or the wrong type.
 */
export function parseSession(body: unknown): Session | null {
  const record = asRecord(body);
  if (record === null) return null;

  const session: Record<string, unknown> = {};
  for (const name of FIELD_NAMES) {
    const { type, wire } = SESSION_FIELDS[name];
    const value = record[wire];
    if (typeof value !== type) return null;
    session[name] = value;
  }
  // Every field was checked against its own spec above, so the shape holds; TS
  // cannot follow the per-field narrowing through the loop.
  return session as unknown as Session;
}
