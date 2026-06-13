# @trustliner/reference

Reference implementation of the trustline-free onboarding standard, demonstrating both
the **sender** and **recipient (sponsored claim)** flows end-to-end on Stellar testnet.

> ✅ **M2 implemented.** Verified on testnet: an unfunded recipient ends up holding the
> asset with **zero XLM** and no pre-existing trustline.

## The mechanic

A trustline can only be added by the account that owns it (`changeTrust` needs the
recipient's signature), so a sender cannot unilaterally set one up. Instead:

1. **Sender flow** — sender escrows the asset as a **claimable balance** for the
   recipient (no recipient account or trustline required).
2. **Recipient flow (sponsored)** — one transaction, with the **sponsor (CAP-33)**
   paying every reserve, creates the recipient account, adds the trustline, and claims
   the balance. The recipient spends no XLM.

```
beginSponsoringFutureReserves(recipient)   [sponsor]
createAccount(recipient, "0")              [sponsor]
changeTrust(asset)                         [recipient]
claimClaimableBalance(balanceId)           [recipient]
endSponsoringFutureReserves()              [recipient]
```

See [the standard](../../standard/sep-draft.md) and
[architecture](../../proposal/architecture.md).

## Run the demo (testnet)

```bash
pnpm --filter @trustliner/reference demo        # amount defaults to 10
pnpm --filter @trustliner/reference demo 25     # custom amount
```

Generates a fresh sender (funded via friendbot) and an unfunded recipient, runs both
flows, and asserts the recipient holds the asset with zero XLM.

## Run the integration test

Off by default (hits the network). Enable with an env var:

```bash
RUN_TESTNET=1 pnpm --filter @trustliner/reference test
```

## Programmatic API

```ts
import { Horizon } from "@stellar/stellar-sdk";
import { TESTNET, runSenderFlow, runRecipientFlow } from "@trustliner/reference";

const server = new Horizon.Server(TESTNET.horizonUrl);
const balanceId = await runSenderFlow({ server, cfg: TESTNET, sender, recipient: recipient.publicKey(), asset, amount: "10" });
await runRecipientFlow({ server, cfg: TESTNET, sponsor: sender, recipient, asset, balanceId, createRecipientAccount: true });
```
