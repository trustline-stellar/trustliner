/**
 * Runnable testnet demo. Build the package, then:
 *   pnpm --filter @trustliner/reference demo
 */
import { runDemo } from "./index.js";

const amount = process.argv[2] ?? "10";

console.log("Trustline Onboarder — testnet demo");
console.log("Onboarding an unfunded recipient (zero XLM, no trustline)...\n");

runDemo(amount)
  .then((r) => {
    console.log("sender (issuer):   ", r.senderPublicKey);
    console.log("recipient:         ", r.recipientPublicKey);
    console.log("claimable balance: ", r.balanceId);
    console.log("");
    console.log(`recipient native XLM: ${r.recipientNativeBalance}  (expected 0.0000000)`);
    console.log(`recipient ${r.assetCode}:      ${r.recipientAssetBalance}  (expected ${amount})`);
    console.log("");
    const ok =
      Number(r.recipientNativeBalance) === 0 &&
      Number(r.recipientAssetBalance) === Number(amount);
    console.log(ok ? "✅ SUCCESS: recipient onboarded with zero XLM." : "❌ unexpected end state.");
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error("demo failed:", err);
    process.exit(1);
  });
