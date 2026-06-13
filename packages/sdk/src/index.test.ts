import { Account, Keypair, Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  buildClaimTx,
  buildCreateAccountTx,
  buildCreateClaimableBalanceTx,
  buildSponsoredClaimTx,
  VERSION,
  type Asset,
} from "./index.js";

const sender = Keypair.random();
const recipient = Keypair.random();
const asset: Asset = { code: "ONBOARD", issuer: sender.publicKey() };

function freshAccount(pubkey: string): Account {
  return new Account(pubkey, "0");
}

describe("@trustliner/sdk", () => {
  it("exposes a version", () => {
    expect(VERSION).toBe("0.0.0");
  });

  it("builds a single-op claimable balance tx for the sender to sign", () => {
    const tx = buildCreateClaimableBalanceTx({
      senderAccount: freshAccount(sender.publicKey()),
      asset,
      amount: "10",
      recipient: recipient.publicKey(),
      networkPassphrase: Networks.TESTNET,
    });
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]?.type).toBe("createClaimableBalance");
    expect(tx.source).toBe(sender.publicKey());
  });

  it("builds the sponsored-claim sandwich with createAccount when requested", () => {
    const tx = buildSponsoredClaimTx({
      sponsorAccount: freshAccount(sender.publicKey()),
      recipient: recipient.publicKey(),
      asset,
      balanceId: "00000000".repeat(9), // dummy 72-hex placeholder
      createRecipientAccount: true,
      networkPassphrase: Networks.TESTNET,
    });
    expect(tx.operations.map((o) => o.type)).toEqual([
      "beginSponsoringFutureReserves",
      "createAccount",
      "changeTrust",
      "claimClaimableBalance",
      "endSponsoringFutureReserves",
    ]);
    // sponsored ops sourced by the recipient; sponsor is the tx source
    expect(tx.source).toBe(sender.publicKey());
    expect(tx.operations[2]?.source).toBe(recipient.publicKey());
    expect(tx.operations[4]?.source).toBe(recipient.publicKey());
  });

  it("builds a sponsor-funded create-account tx (wallet flow)", () => {
    const tx = buildCreateAccountTx({
      sponsorAccount: freshAccount(sender.publicKey()),
      recipient: recipient.publicKey(),
      startingBalance: "2",
      networkPassphrase: Networks.TESTNET,
    });
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]?.type).toBe("createAccount");
    expect(tx.source).toBe(sender.publicKey());
  });

  it("builds a recipient-signed trustline + claim tx (wallet flow)", () => {
    const tx = buildClaimTx({
      recipientAccount: freshAccount(recipient.publicKey()),
      asset,
      balanceId: "00000000".repeat(9),
      networkPassphrase: Networks.TESTNET,
    });
    expect(tx.operations.map((o) => o.type)).toEqual([
      "changeTrust",
      "claimClaimableBalance",
    ]);
    expect(tx.source).toBe(recipient.publicKey());
  });

  it("omits createAccount when the recipient account already exists", () => {
    const tx = buildSponsoredClaimTx({
      sponsorAccount: freshAccount(sender.publicKey()),
      recipient: recipient.publicKey(),
      asset,
      balanceId: "00000000".repeat(9),
      createRecipientAccount: false,
      networkPassphrase: Networks.TESTNET,
    });
    expect(tx.operations.map((o) => o.type)).toEqual([
      "beginSponsoringFutureReserves",
      "changeTrust",
      "claimClaimableBalance",
      "endSponsoringFutureReserves",
    ]);
  });
});
