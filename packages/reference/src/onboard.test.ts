import { describe, expect, it } from "vitest";
import { runDemo } from "./index.js";

/**
 * Live testnet integration test. Hits friendbot + Horizon, so it is OFF by default.
 * Run with:  RUN_TESTNET=1 pnpm --filter @trustliner/reference test
 */
const RUN = process.env.RUN_TESTNET === "1";

describe.skipIf(!RUN)("trustline-free onboarding (testnet)", () => {
  it(
    "onboards an unfunded recipient to hold the asset with zero XLM",
    async () => {
      const amount = "10";
      const result = await runDemo(amount);

      expect(Number(result.recipientAssetBalance)).toBe(Number(amount));
      expect(Number(result.recipientNativeBalance)).toBe(0);
    },
    120_000,
  );
});
