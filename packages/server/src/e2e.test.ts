import { Horizon, Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { StellarOnboardingService } from "./service.js";
import type { ServerConfig } from "./types.js";

/**
 * Full SEP loop against testnet: discovery is skipped (we hold the server in-process),
 * but the HTTP request → claim transaction → recipient signature → submit → status flow
 * is exercised end-to-end. Off by default; run with:
 *   RUN_TESTNET=1 pnpm --filter @trustliner/server test
 */
const RUN = process.env.RUN_TESTNET === "1";
const HORIZON = "https://horizon-testnet.stellar.org";

describe.skipIf(!RUN)("SEP onboarding loop (testnet)", () => {
  it(
    "onboards a recipient via the HTTP API, signing the claim like a wallet",
    async () => {
      const server = new Horizon.Server(HORIZON);
      const sender = Keypair.random(); // sender == asset issuer for the demo
      const recipient = Keypair.random();
      const assetCode = "ONBOARD";

      await fetch(`https://friendbot.stellar.org/?addr=${sender.publicKey()}`);

      const config: ServerConfig = {
        senderSecret: sender.secret(),
        horizonUrl: HORIZON,
        networkPassphrase: Networks.TESTNET,
        assets: [
          {
            code: assetCode,
            issuer: sender.publicKey(),
            minAmount: "1",
            maxAmount: "1000",
            enabled: true,
          },
        ],
        accountCreation: "funded",
        fundedStartingBalance: "2",
        claimWindowSeconds: 3600,
        authenticationRequired: false,
      };

      const app = createApp(new StellarOnboardingService(config));

      // 1. Request onboarding.
      const createRes = await app.request("/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: recipient.publicKey(),
          asset_code: assetCode,
          asset_issuer: sender.publicKey(),
          amount: "10",
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string; claim_transaction: string };
      expect(created.claim_transaction).toBeTruthy();

      // 2. Recipient signs the claim transaction (the wallet step).
      const tx = TransactionBuilder.fromXDR(created.claim_transaction, Networks.TESTNET);
      tx.sign(recipient);

      // 3. Submit it back through the server.
      const submitRes = await app.request(`/transactions/${created.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transaction: tx.toXDR() }),
      });
      expect(submitRes.status).toBe(200);
      expect((await submitRes.json()).status).toBe("completed");

      // 4. Status reflects completion and the recipient holds the asset.
      const statusRes = await app.request(`/transactions/${created.id}`);
      expect((await statusRes.json()).status).toBe("completed");

      const acct = await server.loadAccount(recipient.publicKey());
      const held = acct.balances.find((b) => "asset_code" in b && b.asset_code === assetCode);
      expect(Number(held?.balance)).toBe(10);
    },
    120_000,
  );
});
