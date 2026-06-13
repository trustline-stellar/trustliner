import { randomUUID } from "node:crypto";
import { Horizon, Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  buildClaimTx,
  buildCreateAccountTx,
  buildCreateClaimableBalanceTx,
  buildSponsoredClaimTx,
  OnboardingError,
  toStellarAsset,
  type Asset,
  type InfoResponse,
  type OnboardingRequestBody,
  type OnboardingTransaction,
} from "@trustliner/sdk";
import { MemoryStore, type OnboardingRecord } from "./store.js";
import type { OnboardingService, ServerConfig, ServerAsset } from "./types.js";

type AccountResponse = Awaited<ReturnType<Horizon.Server["loadAccount"]>>;

const toTransaction = (r: OnboardingRecord): OnboardingTransaction => ({
  id: r.id,
  status: r.status,
  balance_id: r.balanceId,
  claim_transaction: r.status === "pending_claim" ? r.claimTransactionXdr : undefined,
  network_passphrase: undefined,
  sponsor: r.sponsor,
  expires_at: r.expiresAt,
  claim_tx_hash: r.claimTxHash,
});

/** Real onboarding service backed by Stellar Horizon. */
export class StellarOnboardingService implements OnboardingService {
  private readonly server: Horizon.Server;
  private readonly sender: Keypair;
  private readonly store = new MemoryStore();

  constructor(private readonly config: ServerConfig) {
    this.server = new Horizon.Server(config.horizonUrl);
    this.sender = Keypair.fromSecret(config.senderSecret);
  }

  info(): InfoResponse {
    return {
      assets: this.config.assets.map((a) => ({
        code: a.code,
        issuer: a.issuer,
        min_amount: a.minAmount,
        max_amount: a.maxAmount,
        enabled: a.enabled,
      })),
      account_creation: this.config.accountCreation,
      authentication_required: this.config.authenticationRequired,
      claim_window_seconds: this.config.claimWindowSeconds,
    };
  }

  async create(body: OnboardingRequestBody): Promise<OnboardingTransaction> {
    const { account, asset_code, asset_issuer, amount } = body ?? {};
    if (!account || !asset_code || !asset_issuer || !amount) {
      throw new OnboardingError("invalid_request", "Missing required fields.", 400);
    }
    const assetConfig = this.resolveAsset(asset_code, asset_issuer);
    this.assertAmountInRange(amount, assetConfig);

    const asset: Asset = { code: asset_code, issuer: asset_issuer };
    const np = this.config.networkPassphrase;

    let recipientAccount = await this.loadAccountOrNull(account);
    if (recipientAccount && this.holdsAsset(recipientAccount, asset)) {
      throw new OnboardingError("already_onboarded", "Account already holds the asset.", 409);
    }

    // 1. Escrow the asset as a claimable balance (recipient claims, sponsor reclaims).
    const senderAccount = await this.server.loadAccount(this.sender.publicKey());
    const cbTx = buildCreateClaimableBalanceTx({
      senderAccount,
      asset,
      amount,
      recipient: account,
      networkPassphrase: np,
      reclaim: { sponsor: this.sender.publicKey(), windowSeconds: this.config.claimWindowSeconds },
    });
    cbTx.sign(this.sender);
    await this.submitOrThrow(cbTx);

    const balanceId = await this.findBalanceId(account, asset);

    // 2. Provision the recipient account and build the claim transaction.
    let claimTransactionXdr: string;
    if (this.config.accountCreation === "funded") {
      if (!recipientAccount) {
        const funder = await this.server.loadAccount(this.sender.publicKey());
        const createTx = buildCreateAccountTx({
          sponsorAccount: funder,
          recipient: account,
          startingBalance: this.config.fundedStartingBalance,
          networkPassphrase: np,
        });
        createTx.sign(this.sender);
        await this.submitOrThrow(createTx);
        recipientAccount = await this.server.loadAccount(account);
      }
      claimTransactionXdr = buildClaimTx({
        recipientAccount,
        asset,
        balanceId,
        networkPassphrase: np,
      }).toXDR();
    } else {
      // sponsored: reserves paid via CAP-33; sponsor pre-signs, recipient adds signature.
      const sponsorAccount = await this.server.loadAccount(this.sender.publicKey());
      const claimTx = buildSponsoredClaimTx({
        sponsorAccount,
        recipient: account,
        asset,
        balanceId,
        createRecipientAccount: !recipientAccount,
        networkPassphrase: np,
      });
      claimTx.sign(this.sender);
      claimTransactionXdr = claimTx.toXDR();
    }

    const record: OnboardingRecord = {
      id: randomUUID(),
      status: "pending_claim",
      recipient: account,
      asset,
      amount,
      balanceId,
      claimTransactionXdr,
      sponsor: this.sender.publicKey(),
      expiresAt: new Date(Date.now() + this.config.claimWindowSeconds * 1000).toISOString(),
    };
    this.store.put(record);
    return toTransaction(record);
  }

  async get(id: string): Promise<OnboardingTransaction | undefined> {
    const record = this.store.get(id);
    if (!record) return undefined;
    if (record.status === "pending_claim") {
      const acct = await this.loadAccountOrNull(record.recipient);
      if (acct && this.holdsAsset(acct, record.asset)) {
        record.status = "completed";
      } else if (Date.now() > Date.parse(record.expiresAt)) {
        record.status = "expired";
      }
      this.store.put(record);
    }
    return toTransaction(record);
  }

  async submit(id: string, signedTransactionXdr: string): Promise<OnboardingTransaction> {
    const record = this.store.get(id);
    if (!record) throw new OnboardingError("invalid_request", "Unknown onboarding id.", 404);
    const tx = TransactionBuilder.fromXDR(signedTransactionXdr, this.config.networkPassphrase);
    const hash = await this.submitOrThrow(tx);
    record.status = "completed";
    record.claimTxHash = hash;
    this.store.put(record);
    return toTransaction(record);
  }

  // --- helpers ----------------------------------------------------------------

  private resolveAsset(code: string, issuer: string): ServerAsset {
    const asset = this.config.assets.find(
      (a) => a.code === code && a.issuer === issuer && a.enabled,
    );
    if (!asset) {
      throw new OnboardingError("asset_not_supported", `Asset ${code} not supported.`, 403);
    }
    return asset;
  }

  private assertAmountInRange(amount: string, asset: ServerAsset): void {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      throw new OnboardingError("invalid_request", "Invalid amount.", 400);
    }
    if (n < Number(asset.minAmount) || n > Number(asset.maxAmount)) {
      throw new OnboardingError(
        "amount_out_of_range",
        `Amount must be between ${asset.minAmount} and ${asset.maxAmount}.`,
        403,
      );
    }
  }

  private holdsAsset(account: AccountResponse, asset: Asset): boolean {
    return account.balances.some(
      (b) =>
        "asset_code" in b &&
        b.asset_code === asset.code &&
        b.asset_issuer === asset.issuer &&
        Number(b.balance) > 0,
    );
  }

  private async loadAccountOrNull(id: string): Promise<AccountResponse | null> {
    try {
      return await this.server.loadAccount(id);
    } catch {
      return null;
    }
  }

  private async findBalanceId(recipient: string, asset: Asset): Promise<string> {
    const res = await this.server
      .claimableBalances()
      .claimant(recipient)
      .asset(toStellarAsset(asset))
      .order("desc")
      .limit(1)
      .call();
    const id = res.records[0]?.id;
    if (!id) throw new OnboardingError("internal_error", "Claimable balance not found.", 500);
    return id;
  }

  private async submitOrThrow(
    tx: Parameters<Horizon.Server["submitTransaction"]>[0],
  ): Promise<string> {
    try {
      const res = await this.server.submitTransaction(tx);
      return res.hash;
    } catch (err: unknown) {
      const codes = (
        err as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } }
      )?.response?.data?.extras?.result_codes;
      const flat = JSON.stringify(codes ?? {});
      if (/insufficient_balance|underfunded|low_reserve/.test(flat)) {
        throw new OnboardingError(
          "sponsor_insufficient_balance",
          "Sponsor cannot fund this onboarding right now.",
          422,
        );
      }
      throw new OnboardingError(
        "internal_error",
        `Transaction submission failed${codes ? `: ${flat}` : ""}`,
        500,
      );
    }
  }
}

export { StellarOnboardingService as default };
