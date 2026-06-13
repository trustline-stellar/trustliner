import type {
  AccountCreationStrategy,
  InfoResponse,
  OnboardingRequestBody,
  OnboardingTransaction,
} from "@trustliner/sdk";

/** A non-native asset the sender supports onboarding for. */
export interface ServerAsset {
  code: string;
  issuer: string;
  minAmount: string;
  maxAmount: string;
  enabled: boolean;
}

/** Sender-server configuration. */
export interface ServerConfig {
  /** Sender/sponsor secret key (S...). Holds/sends the asset and pays for onboarding. */
  senderSecret: string;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl?: string;
  assets: ServerAsset[];
  accountCreation: AccountCreationStrategy;
  /** XLM seeded into a new recipient account under the `funded` strategy. */
  fundedStartingBalance: string;
  /** Seconds the recipient has to claim before the sponsor may reclaim. */
  claimWindowSeconds: number;
  /** Require a SEP-0010 bearer token on onboarding requests. */
  authenticationRequired: boolean;
}

/**
 * Onboarding business logic, decoupled from HTTP so the Hono app can be tested with a
 * fake service and the real service can be exercised against testnet.
 */
export interface OnboardingService {
  info(): InfoResponse;
  create(body: OnboardingRequestBody): Promise<OnboardingTransaction>;
  get(id: string): Promise<OnboardingTransaction | undefined>;
  submit(id: string, signedTransactionXdr: string): Promise<OnboardingTransaction>;
}
