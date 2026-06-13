# @trustliner/server

SEP-conformant onboarding server (the **sender** side). Implements the
[Trustline Onboarder standard](../../standard/sep-draft.md): discovery capabilities,
onboarding requests, claim-transaction issuance, submission, and status.

> ✅ **M3.** HTTP API + `funded` and `sponsored` flows. Built on [Hono](https://hono.dev),
> runs on Node (and Vercel/edge runtimes).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/info` | Capabilities: supported assets, limits, account-creation strategy |
| `POST` | `/transactions` | Request onboarding → returns the claim transaction to sign |
| `GET` | `/transactions/:id` | Onboarding status |
| `POST` | `/transactions/:id/submit` | Submit the signed claim transaction |

## Run (testnet)

```bash
SENDER_SECRET=S...your_funded_sender \
ASSET_CODE=USDC ASSET_ISSUER=GA5... \
ACCOUNT_CREATION=funded \
pnpm --filter @trustliner/server start
# listening on :8787
```

Pair it with discovery by serving a `stellar.toml` containing
`TRUSTLINE_ONBOARDER_SERVER="https://<this-server>"`.

## Configuration (env)

| Var | Default | Notes |
| --- | --- | --- |
| `SENDER_SECRET` | — (required) | Sender/sponsor key; holds the asset, pays for onboarding |
| `ASSETS_JSON` / `ASSET_CODE`+`ASSET_ISSUER` | — | Supported asset(s) |
| `ACCOUNT_CREATION` | `funded` | `funded` (wallet-friendly) or `sponsored` (zero XLM) |
| `HORIZON_URL` | testnet | Horizon endpoint |
| `NETWORK_PASSPHRASE` | testnet | |
| `FUNDED_STARTING_BALANCE` | `2` | XLM seeded into a new account under `funded` |
| `CLAIM_WINDOW_SECONDS` | `604800` | Recipient claim window before sponsor reclaim |
| `AUTHENTICATION_REQUIRED` | `false` | Require SEP-0010 bearer (verification is a follow-up) |

## Architecture

`createApp(service)` is the HTTP layer (Hono); `StellarOnboardingService` is the core
logic (talks to Horizon). The service is injectable, so the API is unit-tested with a
fake and the real flow is covered by a gated testnet test:

```bash
RUN_TESTNET=1 pnpm --filter @trustliner/server test
```
