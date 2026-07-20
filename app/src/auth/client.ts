/**
 * Auth client: exchanges email + password for a JWT the app holds and PowerSync
 * accepts (the token's `sub` is the Account id; sync rules scope buckets by that
 * Account's Space memberships). Talks to the minimal auth service
 * (`services/auth`): `POST /auth/login` and `POST /auth/register`, both
 * returning the same token payload.
 *
 * Pure over an injected `fetch` so it is testable without a network (ADR-0004
 * seam discipline). The default is the platform `fetch`.
 */

import { parseSession, type Session } from "./session";

export type { Session };

/** The subset of the Fetch API this client needs. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface AuthClientConfig {
  /** Base URL of the auth service, e.g. `http://10.0.2.2:6060`. */
  baseUrl: string;
  fetch?: FetchLike;
}

export interface Credentials {
  email: string;
  password: string;
}

export type AuthError =
  | "invalid_credentials"
  /** The held session is past its max age (or was rejected): sign in again. */
  | "session_expired"
  | "email_taken"
  | "invalid_request"
  | "unexpected_response";

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError };

export class AuthClient {
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;

  constructor(config: AuthClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetch = config.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  /** Sign in an existing Account. */
  login(creds: Credentials): Promise<AuthResult> {
    return this.post("/auth/login", { creds });
  }

  /** Register a new Account (also returns a session). */
  register(creds: Credentials): Promise<AuthResult> {
    return this.post("/auth/register", { creds });
  }

  /**
   * Trades the held (possibly expired) access token for a fresh one, so
   * `fetchCredentials()` can hand PowerSync a live token on every call rather
   * than replaying a stale one.
   *
   * A `401` here means the session is genuinely over — past the service's
   * session max age, or issued by a key that no longer verifies — and is
   * reported as `session_expired` rather than `invalid_credentials`, because
   * the caller must sign the user out for that and only that. Every other
   * failure is transient and must not.
   *
   * Network failures reject, as with the other methods.
   */
  refresh(accessToken: string): Promise<AuthResult> {
    return this.post("/auth/token", {
      bearer: accessToken,
      unauthorized: "session_expired",
    });
  }

  private async post(
    path: string,
    opts: {
      creds?: Credentials;
      bearer?: string;
      /** What a 401 from this endpoint means. Defaults to bad credentials. */
      unauthorized?: AuthError;
    },
  ): Promise<AuthResult> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: opts.bearer
        ? { authorization: `Bearer ${opts.bearer}` }
        : { "content-type": "application/json" },
      ...(opts.creds ? { body: JSON.stringify(opts.creds) } : {}),
    });

    if (res.status === 200 || res.status === 201) {
      const session = parseSession(await res.json());
      return session
        ? { ok: true, session }
        : { ok: false, error: "unexpected_response" };
    }
    if (res.status === 401) {
      return { ok: false, error: opts.unauthorized ?? "invalid_credentials" };
    }
    if (res.status === 409) return { ok: false, error: "email_taken" };
    if (res.status === 400) return { ok: false, error: "invalid_request" };
    return { ok: false, error: "unexpected_response" };
  }
}
