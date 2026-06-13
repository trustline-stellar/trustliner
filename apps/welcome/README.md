# Welcome to Stellar — onboarding page + Freighter test harness

A browser page that onboards your **Freighter** wallet to a Stellar asset with
**nothing to pay** and **no manual trustline** — the sender funds your account, and you
sign once on testnet.

## Run it

```bash
pnpm --filter @trustliner/welcome dev
# open the printed http://localhost:5173
```

## Test with Freighter (testnet)

1. Install the [Freighter](https://www.freighter.app/) browser extension.
2. In Freighter, switch the network to **Testnet**.
3. Open the page, click **Connect Freighter**, approve access.
4. Click **Onboard my wallet**. Freighter pops up once to sign — approve it.
5. The log shows you received `10 ONBOARD` and **paid nothing** (the small XLM balance
   you see was funded by the sender). ✅
6. Verify independently on
   [stellar.expert (testnet)](https://stellar.expert/explorer/testnet) — paste your
   address: you'll see the new trustline + asset balance.

A fresh Freighter testnet account is the ideal recipient.

## How it works

- An **ephemeral sponsor** (also the demo asset issuer) is generated in the page and
  funded via friendbot. It pays for everything.
- The sponsor escrows the asset (claimable balance) and **creates + funds your account**,
  then **you** sign one transaction in Freighter to add the trustline and claim. No key
  custody, no backend.
- Why the sponsor pre-funds the account: wallets like Freighter refuse to sign from an
  account that does not yet exist on-chain, and Stellar requires a 1 XLM base reserve to
  create one. So the recipient cannot end at a literal zero balance in a wallet flow.
  The **fully-sponsored, zero-balance variant** (`buildSponsoredClaimTx`) is proven by
  the reference package's testnet integration test instead.
- See [the standard](../../standard/sep-draft.md) and
  [architecture](../../proposal/architecture.md).

## Deploy (Vercel preview)

The SDK is a workspace package (not published to npm), so it must be built before the
app. The app's `build` script does this (`pnpm --filter @trustliner/sdk build
&& vite build`), and the repo-root `vercel.json` configures a root-directory project.

- **Root Directory = repo root** (recommended): `vercel.json` handles build + output
  (`apps/welcome/dist`).
- **Root Directory = `apps/welcome`**: the self-contained `build` script handles it;
  output `dist` is auto-detected.

No environment variables required.

## Notes

- Build tooling: Vite. `@stellar/stellar-sdk`'s browser bundle needs `unenv/*`
  polyfills, supplied by the `unenv` (v2.x) dev dependency.
- This is also the starting point for the M4 production landing page.
