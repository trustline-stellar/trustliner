# @trustliner/sdk

TypeScript SDK for trustline-free Stellar asset onboarding. Lets wallets and exchanges
deliver a non-native asset to a recipient with no XLM and no trustline.

> 🚧 Foundation skeleton — public API sketched; implementation lands in milestone **M3**.

## Install

```bash
pnpm add @trustliner/sdk @stellar/stellar-sdk
```

## Usage (planned API)

```ts
import { OnboarderSender, OnboarderRecipient } from "@trustliner/sdk";

const sender = new OnboarderSender({ horizonUrl, networkPassphrase });
const auth = await sender.authorize({ recipient, asset, amount });
const { unsignedXdr } = await sender.buildSettlement({ recipient, asset, amount }, auth);
// caller signs and submits — the SDK never custodies keys
```

See the [standard](../../standard/sep-draft.md) for protocol details.
