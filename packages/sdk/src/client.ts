/**
 * SEP-conformant client for the Trustline Onboarder protocol. Used by wallet/recipient
 * tooling to discover a sender, read its capabilities, request onboarding, and track it.
 *
 * @see ../../standard/sep-draft.md
 */

import type { StellarAddress } from "./builders.js";

// --- Protocol types ------------------------------------------------------------

export type AccountCreationStrategy = "funded" | "sponsored";

export interface AssetInfo {
  code: string;
  issuer: StellarAddress;
  min_amount: string;
  max_amount: string;
  enabled: boolean;
}

export interface InfoResponse {
  assets: AssetInfo[];
  account_creation: AccountCreationStrategy;
  authentication_required: boolean;
  claim_window_seconds: number;
}

export type OnboardingStatus = "pending_claim" | "completed" | "expired" | "error";

export interface OnboardingTransaction {
  id: string;
  status: OnboardingStatus;
  balance_id?: string;
  /** Unsigned (or sponsor-signed) claim transaction XDR for the recipient to sign. */
  claim_transaction?: string;
  network_passphrase?: string;
  sponsor?: StellarAddress;
  expires_at?: string;
  claim_tx_hash?: string;
}

export interface OnboardingRequestBody {
  account: StellarAddress;
  asset_code: string;
  asset_issuer: StellarAddress;
  amount: string;
}

export type OnboardingErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "asset_not_supported"
  | "amount_out_of_range"
  | "already_onboarded"
  | "sponsor_insufficient_balance"
  | "authorization_expired"
  | "internal_error";

/** Error thrown for any non-2xx response from an onboarding server. */
export class OnboardingError extends Error {
  constructor(
    readonly code: OnboardingErrorCode | string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

// --- Client --------------------------------------------------------------------

export interface ClientOptions {
  /** SEP-0010 bearer token, if the server requires authentication. */
  jwt?: string;
  /** Override fetch (for tests). Defaults to global fetch. */
  fetch?: typeof fetch;
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

async function parseError(res: Response): Promise<OnboardingError> {
  let code = "internal_error";
  let message = `request failed with ${res.status}`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body.error) code = body.error;
    if (body.message) message = body.message;
  } catch {
    // non-JSON error body; keep defaults
  }
  return new OnboardingError(code, message, res.status);
}

/**
 * Discover the onboarding server for a home domain by reading its `stellar.toml`
 * (`TRUSTLINE_ONBOARDER_SERVER`). Returns the server base URL, or null if unsupported.
 */
export async function resolveOnboarderServer(
  homeDomain: string,
  opts: ClientOptions = {},
): Promise<string | null> {
  const doFetch = opts.fetch ?? fetch;
  const domain = homeDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const res = await doFetch(`https://${domain}/.well-known/stellar.toml`);
  if (!res.ok) return null;
  const toml = await res.text();
  const match = toml.match(/^\s*TRUSTLINE_ONBOARDER_SERVER\s*=\s*"([^"]+)"/m);
  return match?.[1] ? trimSlash(match[1]) : null;
}

/** Read a sender's onboarding capabilities. */
export async function fetchInfo(
  serverUrl: string,
  opts: ClientOptions = {},
): Promise<InfoResponse> {
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(`${trimSlash(serverUrl)}/info`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as InfoResponse;
}

/** Request onboarding for a recipient. Returns the claim transaction to sign. */
export async function requestOnboarding(
  serverUrl: string,
  body: OnboardingRequestBody,
  opts: ClientOptions = {},
): Promise<OnboardingTransaction> {
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(`${trimSlash(serverUrl)}/transactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.jwt ? { authorization: `Bearer ${opts.jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as OnboardingTransaction;
}

/** Fetch the current status of an onboarding. */
export async function getOnboarding(
  serverUrl: string,
  id: string,
  opts: ClientOptions = {},
): Promise<OnboardingTransaction> {
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(`${trimSlash(serverUrl)}/transactions/${encodeURIComponent(id)}`, {
    headers: opts.jwt ? { authorization: `Bearer ${opts.jwt}` } : undefined,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as OnboardingTransaction;
}

/**
 * Hand a signed claim transaction back to the server to submit (optional convenience so
 * the recipient need not talk to Horizon directly; also lets the server fee-bump).
 */
export async function submitClaim(
  serverUrl: string,
  id: string,
  signedTransactionXdr: string,
  opts: ClientOptions = {},
): Promise<OnboardingTransaction> {
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(
    `${trimSlash(serverUrl)}/transactions/${encodeURIComponent(id)}/submit`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opts.jwt ? { authorization: `Bearer ${opts.jwt}` } : {}),
      },
      body: JSON.stringify({ transaction: signedTransactionXdr }),
    },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as OnboardingTransaction;
}
