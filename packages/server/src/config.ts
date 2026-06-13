import { Networks } from "@stellar/stellar-sdk";
import type { AccountCreationStrategy } from "@trustliner/sdk";
import type { ServerAsset, ServerConfig } from "./types.js";

/**
 * Build server config from environment variables.
 *
 * Required: SENDER_SECRET. Assets come from ASSETS_JSON (a JSON array of
 * {code,issuer,minAmount,maxAmount,enabled}) or the single ASSET_CODE/ASSET_ISSUER pair.
 */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const senderSecret = env.SENDER_SECRET;
  if (!senderSecret) throw new Error("SENDER_SECRET is required");

  let assets: ServerAsset[];
  if (env.ASSETS_JSON) {
    assets = JSON.parse(env.ASSETS_JSON) as ServerAsset[];
  } else if (env.ASSET_CODE && env.ASSET_ISSUER) {
    assets = [
      {
        code: env.ASSET_CODE,
        issuer: env.ASSET_ISSUER,
        minAmount: env.ASSET_MIN_AMOUNT ?? "1",
        maxAmount: env.ASSET_MAX_AMOUNT ?? "1000",
        enabled: true,
      },
    ];
  } else {
    throw new Error("Provide ASSETS_JSON or ASSET_CODE + ASSET_ISSUER");
  }

  const accountCreation = (env.ACCOUNT_CREATION as AccountCreationStrategy) ?? "funded";

  return {
    senderSecret,
    horizonUrl: env.HORIZON_URL ?? "https://horizon-testnet.stellar.org",
    networkPassphrase: env.NETWORK_PASSPHRASE ?? Networks.TESTNET,
    friendbotUrl: env.FRIENDBOT_URL ?? "https://friendbot.stellar.org",
    assets,
    accountCreation,
    fundedStartingBalance: env.FUNDED_STARTING_BALANCE ?? "2",
    claimWindowSeconds: Number(env.CLAIM_WINDOW_SECONDS ?? 604800),
    authenticationRequired: env.AUTHENTICATION_REQUIRED === "true",
  };
}
