## Preamble

```
SEP: TBD
Title: Trustline-Free Asset Onboarding
Author: TODO (applicant)
Track: Standard
Status: Draft
Created: 2026-06-08
Updated: 2026-06-09
Version: 0.2.0
Discussion: TODO (RFC link)
```

## Simple Summary

A standard HTTP handshake plus on-chain settlement that lets a **sender** (exchange or
wallet) deliver a non-native Stellar asset to a **recipient** who holds no XLM and has no
trustline. The sender pays for the recipient's account and reserves; the recipient signs
at most one transaction to receive the asset. No protocol change is required.

## Dependencies

- **SEP-0001** — `stellar.toml`, used for sender discovery.
- **SEP-0010** — Stellar Web Authentication, used (optionally) to authenticate the
  recipient before onboarding.
- **CAP-0023** — Claimable Balances.
- **CAP-0033** — Sponsored Reserves.

This SEP's HTTP shape intentionally mirrors the conventions of SEP-0006 / SEP-0024
(info + transaction resources + status polling) so that integrators reuse familiar
patterns. Those SEPs are referenced for style only and are not normative here.

## Motivation

Receiving a non-native asset on Stellar requires a funded account and a pre-established
trustline. New users from exchanges and fresh wallets have neither, which is the largest
drop-off point in asset onboarding. A shared standard replaces bespoke, non-interoperable
integrations with one documented protocol.

## Abstract

1. **Discovery** — the sender advertises an onboarding server in its `stellar.toml`.
2. **Capabilities** — `GET /info` describes supported assets, limits, the account
   creation strategy, and whether authentication is required.
3. **Onboarding request** — the recipient's wallet posts an onboarding request; the
   sender escrows the asset as a claimable balance, provisions the recipient account, and
   returns an unsigned **claim transaction**.
4. **Claim** — the recipient signs the claim transaction (add trustline + claim) and it
   is submitted. Unclaimed onboarding is recoverable by the sender.

## Specification

### Roles

| Role | Description |
| --- | --- |
| **Sender** | Service (exchange/wallet backend) that runs the onboarding server, holds/sends the asset, signs sender-side operations, and pays fees. |
| **Recipient** | The onboarding user, represented by wallet/client tooling. May not yet have an account on the network. |
| **Issuer** | The asset's issuer. MAY be a third party distinct from the sender. |
| **Sponsor** | Account paying the recipient's reserves and fees. Defaults to the sender. |

### Discovery

The sender publishes a `stellar.toml` (SEP-0001) containing:

```toml
TRUSTLINE_ONBOARDER_SERVER = "https://onboard.example.com"
```

`TRUSTLINE_ONBOARDER_SERVER` is the HTTPS base URL of the onboarding server. All endpoint
paths below are relative to it.

### Authentication

If `GET /info` reports `"authentication_required": true`, the recipient MUST obtain a
SEP-0010 JWT and send it as `Authorization: Bearer <jwt>` on `POST /transactions`. The
authenticated account MUST equal the `account` in the request body. Servers MAY operate
unauthenticated for low-value testnet/demo assets.

### `GET /info`

Returns sender capabilities. No authentication.

```json
{
  "assets": [
    {
      "code": "USDC",
      "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "min_amount": "1",
      "max_amount": "1000",
      "enabled": true
    }
  ],
  "account_creation": "funded",
  "authentication_required": false,
  "claim_window_seconds": 604800
}
```

- `account_creation` — strategy used when the recipient account does not exist yet:
  - `"funded"` — the sender creates and funds the account with a small XLM balance
    (covers base reserve + trustline reserve + fees). REQUIRED for wallets that refuse to
    sign from an account that does not yet exist on-chain (e.g. Freighter). The recipient
    spends nothing; a small sender-funded XLM balance remains.
  - `"sponsored"` — the sender uses CAP-0033 sponsored reserves so the recipient holds
    **zero** XLM. The recipient MUST co-sign account creation, so this strategy requires a
    wallet/SDK able to sign for a not-yet-created account.
- `claim_window_seconds` — how long the claimable balance remains claimable by the
  recipient before the sender may reclaim it (see [Reclaim](#reclaim)).

### `POST /transactions`

The recipient requests onboarding.

Request:

```json
{
  "account": "GBQ...recipient",
  "asset_code": "USDC",
  "asset_issuer": "GA5...",
  "amount": "25"
}
```

The server MUST:

1. Validate the asset is supported and `amount` is within `[min_amount, max_amount]`.
2. If the recipient already holds the asset (trustline to `asset_issuer` with the asset
   balance present), return `409 already_onboarded`.
3. Create a **claimable balance** of `amount` of the asset addressed to the recipient,
   signed and submitted by the sender (see [Claimable balance](#claimable-balance)).
4. If the recipient account does not exist, provision it per `account_creation`.
5. Build an **unsigned claim transaction** for the recipient.

Response `201`:

```json
{
  "id": "9d1f…",
  "status": "pending_claim",
  "balance_id": "00000000abc…",
  "claim_transaction": "<base64 unsigned Transaction XDR>",
  "network_passphrase": "Public Global Stellar Network ; September 2015",
  "sponsor": "GSPONSOR…",
  "expires_at": "2026-06-16T00:00:00Z"
}
```

The recipient signs `claim_transaction` with its key (e.g. via the wallet) and either
submits it to the network directly or returns it via `POST /transactions/:id/submit`
(servers MAY offer the latter to fee-bump and submit on the recipient's behalf).

### `GET /transactions/:id`

Returns the onboarding status. Authentication as for `POST /transactions`.

```json
{ "id": "9d1f…", "status": "completed", "claim_tx_hash": "abc…" }
```

### Status lifecycle

```
pending_claim → completed
pending_claim → expired        (recipient never claimed; sender reclaimed)
pending_claim → error
```

### On-chain settlement

#### Claimable balance

The sender creates a claimable balance with two claimants:

- **Recipient** — predicate `BEFORE_RELATIVE_TIME(claim_window_seconds)` (claimable until
  the window closes).
- **Sponsor** — predicate `NOT BEFORE_RELATIVE_TIME(claim_window_seconds)` (reclaimable
  only after the window closes).

This guarantees the recipient can claim during the window and the sender can recover the
funds afterward, so balances are never permanently stranded.

#### Account provisioning

`funded` strategy (sender-signed, no recipient signature):

```
createAccount(destination = recipient, startingBalance = <covers base + trustline + fees>)
```

`sponsored` strategy (CAP-0033 sandwich; recipient co-signs):

```
beginSponsoringFutureReserves(sponsoredId = recipient)   [source: sponsor]
createAccount(destination = recipient, startingBalance = "0")  [source: sponsor]
endSponsoringFutureReserves()                            [source: recipient]
```

#### Claim transaction

The unsigned `claim_transaction` returned to the recipient contains, in order:

```
changeTrust(asset)                       [source: recipient]
claimClaimableBalance(balance_id)        [source: recipient]
```

In `sponsored` deployments the trustline reserve MAY itself be sponsored by wrapping the
`changeTrust` in a CAP-0033 sandwich and fee-bumping the transaction with the sponsor as
fee source, so the recipient holds zero XLM and pays no fee.

#### Fees

The sender/sponsor is responsible for all fees it can pay as transaction source
(claimable balance creation, account provisioning). For the recipient's claim
transaction: under `funded` the recipient pays the (negligible) fee from the
sender-provided balance; under `sponsored` the claim transaction SHOULD be a fee-bump
transaction with the sponsor as fee source.

#### Asset authorization flags

If the asset has `AUTHORIZATION_REQUIRED`, the issuer MUST authorize the recipient's
trustline (e.g. via `setTrustLineFlags`) for the claim to succeed; the sender MUST
coordinate this with the issuer or reject the request with `asset_not_supported`. If the
asset is clawback-enabled, `GET /info` SHOULD surface this so wallets can inform users.

### Error semantics

Errors use the appropriate HTTP status with a JSON body:

```json
{ "error": "already_onboarded", "message": "Account already holds USDC." }
```

| HTTP | `error` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | Malformed body or parameters. |
| 401 | `unauthorized` | Missing/invalid SEP-0010 token, or token account ≠ `account`. |
| 403 | `asset_not_supported` | Asset not offered by this sender. |
| 403 | `amount_out_of_range` | `amount` outside `[min_amount, max_amount]`. |
| 409 | `already_onboarded` | Recipient already holds the asset. |
| 422 | `sponsor_insufficient_balance` | Sponsor cannot fund reserves/fees right now. |
| 410 | `authorization_expired` | Onboarding/claim window elapsed. |
| 500 | `internal_error` | Unexpected server error. |

## Design Rationale

See [`rationale.md`](./rationale.md). In particular, the two `account_creation`
strategies exist because Stellar requires a ≥ 1 XLM base reserve to create an account and
common wallets refuse to sign transactions from an account that does not yet exist —
making a literal zero-balance result impossible in those wallet flows, while still
achievable programmatically via the `sponsored` strategy.

## Security Concerns

See [`security.md`](./security.md). Summary: authorization expiry + per-recipient limits
mitigate sponsor griefing; precise claim predicates guarantee recipient-only claim and
sender reclaim; the SDK never custodies recipient keys.

## Implementation

- Server: [`../packages/server`](../packages/server) — SEP-conformant sender server
  (`/info`, `/transactions`, status, submit) on Hono.
- SDK: [`../packages/sdk`](../packages/sdk) — transaction builders for both strategies
  plus the SEP client (discovery, info, request, status, submit).
- Reference implementation: [`../packages/reference`](../packages/reference) — proves both
  the `sponsored` (zero-balance) and `funded` (wallet) flows on testnet.
- Live wallet demo: [`../apps/welcome`](../apps/welcome) — `funded` flow signed by
  Freighter on testnet.
