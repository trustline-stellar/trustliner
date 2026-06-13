/**
 * @trustliner/reference
 *
 * Reference implementation of the trustline-free onboarding standard against the
 * Stellar testnet. Demonstrates that a recipient can end up holding a non-native asset
 * with ZERO XLM and no pre-existing trustline.
 *
 * @see ../../standard/sep-draft.md
 * @see ../../proposal/architecture.md
 */

import { Horizon, Keypair, Networks, type Transaction } from "@stellar/stellar-sdk";
import {
  buildCreateClaimableBalanceTx,
  buildSponsoredClaimTx,
  type Asset,
} from "@trustliner/sdk";

export interface NetworkConfig {
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl: string;
}

export const TESTNET: NetworkConfig = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  friendbotUrl: "https://friendbot.stellar.org",
};

/** Fund a brand-new account on testnet via friendbot. */
export async function fundWithFriendbot(
  publicKey: string,
  cfg: NetworkConfig = TESTNET,
): Promise<void> {
  const res = await fetch(`${cfg.friendbotUrl}/?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    throw new Error(`friendbot funding failed for ${publicKey}: ${res.status} ${await res.text()}`);
  }
}

/** Submit a signed transaction, surfacing Stellar result codes on failure. */
async function submit(server: Horizon.Server, tx: Transaction): Promise<string> {
  try {
    const res = await server.submitTransaction(tx);
    return res.hash;
  } catch (err: unknown) {
    const codes = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
      ?.response?.data?.extras?.result_codes;
    throw new Error(
      `transaction submission failed${codes ? `: ${JSON.stringify(codes)}` : ""}`,
      { cause: err },
    );
  }
}

export interface SenderFlowParams {
  server: Horizon.Server;
  cfg: NetworkConfig;
  /** Holds or issues the asset; pays the fee and signs. */
  sender: Keypair;
  recipient: string;
  asset: Asset;
  amount: string;
}

/**
 * Sender flow: escrow `amount` of `asset` as a claimable balance for `recipient`,
 * who needs no account and no trustline. Returns the claimable balance id.
 */
export async function runSenderFlow(params: SenderFlowParams): Promise<string> {
  const { server, cfg, sender, recipient, asset, amount } = params;

  const senderAccount = await server.loadAccount(sender.publicKey());
  const tx = buildCreateClaimableBalanceTx({
    senderAccount,
    asset,
    amount,
    recipient,
    networkPassphrase: cfg.networkPassphrase,
  });
  tx.sign(sender);
  await submit(server, tx);

  const balances = await server.claimableBalances().claimant(recipient).limit(1).call();
  const id = balances.records[0]?.id;
  if (!id) throw new Error("claimable balance not found after creation");
  return id;
}

export interface RecipientFlowParams {
  server: Horizon.Server;
  cfg: NetworkConfig;
  /** Pays every reserve (CAP-33) and the fee; signs. Typically the sender. */
  sponsor: Keypair;
  /** The onboarding recipient; co-signs. */
  recipient: Keypair;
  asset: Asset;
  balanceId: string;
  /** True if the recipient account does not exist yet. */
  createRecipientAccount: boolean;
}

/**
 * Recipient flow (sponsored): create the recipient account if needed, add the
 * trustline, and claim the balance in one transaction, with the sponsor paying all
 * reserves. The recipient spends no XLM.
 */
export async function runRecipientFlow(params: RecipientFlowParams): Promise<string> {
  const { server, cfg, sponsor, recipient, asset, balanceId, createRecipientAccount } =
    params;

  const sponsorAccount = await server.loadAccount(sponsor.publicKey());
  const tx = buildSponsoredClaimTx({
    sponsorAccount,
    recipient: recipient.publicKey(),
    asset,
    balanceId,
    createRecipientAccount,
    networkPassphrase: cfg.networkPassphrase,
  });
  tx.sign(sponsor, recipient);
  return submit(server, tx);
}

export interface DemoResult {
  senderPublicKey: string;
  recipientPublicKey: string;
  balanceId: string;
  assetCode: string;
  /** Recipient's native XLM balance after onboarding (expected "0.0000000"). */
  recipientNativeBalance: string;
  /** Recipient's asset balance after onboarding (expected to equal `amount`). */
  recipientAssetBalance: string;
}

/**
 * End-to-end demo on testnet:
 *   1. create + fund a sender (also the asset issuer)
 *   2. sender escrows the asset as a claimable balance for an unfunded recipient
 *   3. sponsored claim creates the recipient account, adds the trustline, and claims
 *   4. assert the recipient holds the asset with zero XLM
 */
export async function runDemo(amount = "10", cfg: NetworkConfig = TESTNET): Promise<DemoResult> {
  const server = new Horizon.Server(cfg.horizonUrl);

  const sender = Keypair.random();
  const recipient = Keypair.random();
  const asset: Asset = { code: "ONBOARD", issuer: sender.publicKey() };

  await fundWithFriendbot(sender.publicKey(), cfg);

  const balanceId = await runSenderFlow({
    server,
    cfg,
    sender,
    recipient: recipient.publicKey(),
    asset,
    amount,
  });

  await runRecipientFlow({
    server,
    cfg,
    sponsor: sender,
    recipient,
    asset,
    balanceId,
    createRecipientAccount: true,
  });

  const recipientAccount = await server.loadAccount(recipient.publicKey());
  const native = recipientAccount.balances.find((b) => b.asset_type === "native");
  const held = recipientAccount.balances.find(
    (b) => "asset_code" in b && b.asset_code === asset.code,
  );

  return {
    senderPublicKey: sender.publicKey(),
    recipientPublicKey: recipient.publicKey(),
    balanceId,
    assetCode: asset.code,
    recipientNativeBalance: native?.balance ?? "missing",
    recipientAssetBalance: held?.balance ?? "missing",
  };
}
