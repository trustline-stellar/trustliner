import {
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { Horizon, Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  buildClaimTx,
  buildCreateAccountTx,
  buildCreateClaimableBalanceTx,
  type Asset,
} from "@trustliner/sdk";

// XLM the sponsor seeds the new recipient account with. Covers the 1 XLM base reserve,
// the 0.5 XLM trustline reserve, and transaction fees. The recipient pays nothing.
const SPONSOR_STARTING_BALANCE = "2";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const ASSET_CODE = "ONBOARD";
const AMOUNT = "10";

const server = new Horizon.Server(HORIZON_URL);

// --- DOM helpers ---------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};
const connectBtn = $<HTMLButtonElement>("connect");
const onboardBtn = $<HTMLButtonElement>("onboard");
const addressEl = $("address");
const logEl = $("log");
const explorerEl = $<HTMLAnchorElement>("explorer");

const log = (msg: string) => {
  logEl.textContent += `${msg}\n`;
};
const reset = () => {
  logEl.textContent = "";
};

let recipientAddress: string | null = null;
// Reused across clicks in this page session so the asset identity (code + issuer) stays
// stable. A fresh issuer per click would create a *different* asset that merely shares
// the code "ONBOARD", showing up as a duplicate trustline in the wallet.
let sponsor: Keypair | null = null;
let asset: Asset | null = null;

// --- network helpers -----------------------------------------------------------
async function fundWithFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`friendbot failed: ${res.status}`);
}

async function accountExists(id: string): Promise<boolean> {
  try {
    await server.loadAccount(id);
    return true;
  } catch {
    return false;
  }
}

async function submit(xdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  try {
    const res = await server.submitTransaction(tx);
    return res.hash;
  } catch (err: unknown) {
    const codes = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
      ?.response?.data?.extras?.result_codes;
    throw new Error(`submit failed${codes ? `: ${JSON.stringify(codes)}` : ""}`);
  }
}

// --- connect -------------------------------------------------------------------
connectBtn.addEventListener("click", async () => {
  reset();
  try {
    const conn = await isConnected();
    if (!conn.isConnected) {
      log("Freighter not detected. Install it and reload.");
      return;
    }
    const access = await requestAccess();
    if (access.error) {
      log(`Access denied: ${access.error}`);
      return;
    }
    const net = await getNetwork();
    if (net.error) {
      log(`Could not read network: ${net.error}`);
      return;
    }
    if (net.networkPassphrase !== Networks.TESTNET) {
      log(`Freighter is on "${net.network}". Switch it to TESTNET and reconnect.`);
      return;
    }
    recipientAddress = access.address;
    addressEl.textContent = recipientAddress;
    onboardBtn.disabled = false;
    log("Connected on Testnet. Ready to onboard.");
  } catch (err) {
    log(`Connect error: ${(err as Error).message}`);
  }
});

// --- onboard -------------------------------------------------------------------
onboardBtn.addEventListener("click", async () => {
  if (!recipientAddress) return;
  const recipient = recipientAddress;
  onboardBtn.disabled = true;
  reset();
  explorerEl.hidden = true;

  try {
    // 1. Ephemeral sponsor (also the asset issuer), created once per session and reused.
    if (!sponsor || !asset) {
      sponsor = Keypair.random();
      asset = { code: ASSET_CODE, issuer: sponsor.publicKey() };
      log(`Sponsor (this session): ${sponsor.publicKey()}`);
      log("Funding sponsor via friendbot…");
      await fundWithFriendbot(sponsor.publicKey());
    }
    // Non-null locals (module-level lets lose narrowing across awaits).
    if (!sponsor || !asset) throw new Error("sponsor not initialized");
    const activeSponsor = sponsor;
    const activeAsset = asset;
    const issuer = activeAsset.issuer;

    // Idempotency: if the wallet already holds this exact asset, do nothing. Prevents
    // minting a second balance / adding a duplicate trustline on repeat clicks.
    if (await accountExists(recipient)) {
      const acct = await server.loadAccount(recipient);
      const already = acct.balances.find(
        (b) =>
          "asset_code" in b &&
          b.asset_code === ASSET_CODE &&
          b.asset_issuer === issuer &&
          Number(b.balance) > 0,
      );
      if (already) {
        log(`Already onboarded — your wallet holds ${already.balance} ${ASSET_CODE}.`);
        explorerEl.href = `https://stellar.expert/explorer/testnet/account/${recipient}`;
        explorerEl.hidden = false;
        return;
      }
    }

    // 2. Sender flow: escrow the asset as a claimable balance for the recipient.
    log("Creating claimable balance…");
    let sponsorAccount = await server.loadAccount(activeSponsor.publicKey());
    const cbTx = buildCreateClaimableBalanceTx({
      senderAccount: sponsorAccount,
      asset: activeAsset,
      amount: AMOUNT,
      recipient,
      networkPassphrase: Networks.TESTNET,
    });
    cbTx.sign(activeSponsor);
    await submit(cbTx.toXDR());

    const balances = await server.claimableBalances().claimant(recipient).limit(1).call();
    const balanceId = balances.records[0]?.id;
    if (!balanceId) throw new Error("claimable balance not found");
    log(`Claimable balance: ${balanceId}`);

    // 3. Sponsor creates + funds the recipient account (the sponsor pays for it).
    //    Wallets like Freighter refuse to sign from an account that does not yet exist,
    //    so the account must be created before the recipient signs.
    if (await accountExists(recipient)) {
      log("Recipient account already exists — skipping creation.");
    } else {
      log("Sponsor is creating + funding your account…");
      sponsorAccount = await server.loadAccount(activeSponsor.publicKey());
      const createTx = buildCreateAccountTx({
        sponsorAccount,
        recipient,
        startingBalance: SPONSOR_STARTING_BALANCE,
        networkPassphrase: Networks.TESTNET,
      });
      createTx.sign(activeSponsor);
      await submit(createTx.toXDR());
    }

    // 4. Recipient adds the trustline and claims the balance, signing in Freighter.
    const recipientAccount = await server.loadAccount(recipient);
    const claimTx = buildClaimTx({
      recipientAccount,
      asset: activeAsset,
      balanceId,
      networkPassphrase: Networks.TESTNET,
    });
    log("Requesting your signature in Freighter…");
    const signed = await signTransaction(claimTx.toXDR(), {
      networkPassphrase: Networks.TESTNET,
      address: recipient,
    });
    if (signed.error) throw new Error(`Freighter signing failed: ${signed.error}`);

    log("Submitting…");
    const hash = await submit(signed.signedTxXdr);
    log(`Submitted: ${hash}`);

    // 5. Show the end state.
    const acct = await server.loadAccount(recipient);
    const held = acct.balances.find(
      (b) => "asset_code" in b && b.asset_code === ASSET_CODE && b.asset_issuer === issuer,
    );
    log("");
    log(`You paid:     0 XLM (the sender funded everything)`);
    log(`Your ${ASSET_CODE}: ${held?.balance ?? "missing"}`);
    log(
      Number(held?.balance) === Number(AMOUNT)
        ? "\n✅ Onboarded — asset received, no trustline setup, nothing paid."
        : "\n⚠️ Unexpected end state — check the explorer.",
    );

    explorerEl.href = `https://stellar.expert/explorer/testnet/account/${recipient}`;
    explorerEl.hidden = false;
  } catch (err) {
    log(`\nError: ${(err as Error).message}`);
  } finally {
    onboardBtn.disabled = false;
  }
});
