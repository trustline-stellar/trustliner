/**
 * @trustliner/sdk
 *
 * Libraries for trustline-free Stellar asset onboarding:
 * - {@link ./builders.ts | builders} — pure transaction builders (no network, no keys)
 * - {@link ./client.ts | client} — SEP-conformant HTTP client for wallet/recipient tooling
 *
 * Core mechanic: a recipient cannot be given a trustline by someone else (changeTrust
 * needs the recipient's own signature). So the sender escrows the asset as a claimable
 * balance and pays the recipient's account/reserves, and the recipient signs at most one
 * transaction to receive it.
 *
 * @see ../../standard/sep-draft.md
 */

export * from "./builders.js";
export * from "./client.js";

export const VERSION = "0.0.0";
