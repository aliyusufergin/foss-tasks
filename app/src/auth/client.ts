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

/** A held session: the JWT plus the identity claims the app needs. */
export interface Session {
  accessToken: string;
  tokenType: string;
  /** Seconds until the token expires (from issuance). */
  expiresIn: number;
  accountId: string;
  personalSpaceId: string;
}

export type AuthError =
  | "invalid_credentials"
  | "email_taken"
  | "invalid_request"
  | "unexpected_response";

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError };

interface TokenPayload {
  access_token: string;
  token_type: string;
  expires_in: number;
  account_id: string;
  personal_space_id: string;
}

function parseSession(body: unknown): Session | null {
  if (typeof body !== "object" || body === null) return null;
  const p = body as Partial<TokenPayload>;
  if (
    typeof p.access_token !== "string" ||
    typeof p.token_type !== "string" ||
    typeof p.expires_in !== "number" ||
    typeof p.account_id !== "string" ||
    typeof p.personal_space_id !== "string"
  ) {
    return null;
  }
  return {
    accessToken: p.access_token,
    tokenType: p.token_type,
    expiresIn: p.expires_in,
    accountId: p.account_id,
    personalSpaceId: p.personal_space_id,
  };
}

export class AuthClient {
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;

  constructor(config: AuthClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetch = config.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  /** Sign in an existing Account. */
  login(creds: Credentials): Promise<AuthResult> {
    return this.post("/auth/login", creds);
  }

  /** Register a new Account (also returns a session). */
  register(creds: Credentials): Promise<AuthResult> {
    return this.post("/auth/register", creds);
  }

  private async post(path: string, creds: Credentials): Promise<AuthResult> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(creds),
    });

    if (res.status === 200 || res.status === 201) {
      const session = parseSession(await res.json());
      return session
        ? { ok: true, session }
        : { ok: false, error: "unexpected_response" };
    }
    if (res.status === 401) return { ok: false, error: "invalid_credentials" };
    if (res.status === 409) return { ok: false, error: "email_taken" };
    if (res.status === 400) return { ok: false, error: "invalid_request" };
    return { ok: false, error: "unexpected_response" };
  }
}
