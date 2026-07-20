/** A registered user. `personalSpaceId` is the Space created at registration. */
export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  personalSpaceId: string;
}

/**
 * Persistence seam for the auth domain. Implementations must make
 * {@link AuthRepo.createAccountWithPersonalSpace} atomic — an Account without
 * its Personal Space (or vice versa) must never be observable.
 */
export interface AuthRepo {
  findAccountByEmail(email: string): Promise<AccountRecord | null>;

  /**
   * Looks up an Account by id. Used when re-issuing a token, so that a deleted
   * Account stops getting fresh tokens and so the re-issued token carries the
   * Account's *current* Personal Space rather than whatever the held token said.
   */
  findAccountById(id: string): Promise<AccountRecord | null>;

  createAccountWithPersonalSpace(input: {
    accountId: string;
    email: string;
    passwordHash: string;
    spaceId: string;
    membershipId: string;
    now: Date;
  }): Promise<void>;
}
