import type { Asset, OnboardingStatus } from "@trustliner/sdk";

/** Internal onboarding record (superset of what is exposed over HTTP). */
export interface OnboardingRecord {
  id: string;
  status: OnboardingStatus;
  recipient: string;
  asset: Asset;
  amount: string;
  balanceId: string;
  claimTransactionXdr: string;
  sponsor: string;
  expiresAt: string;
  claimTxHash?: string;
}

/** Minimal in-memory store. Swap for a database in production. */
export class MemoryStore {
  private readonly records = new Map<string, OnboardingRecord>();

  put(record: OnboardingRecord): void {
    this.records.set(record.id, record);
  }

  get(id: string): OnboardingRecord | undefined {
    return this.records.get(id);
  }
}
