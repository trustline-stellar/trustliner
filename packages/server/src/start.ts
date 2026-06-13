/**
 * Runnable server entry. Configure via environment (see config.ts), then:
 *   SENDER_SECRET=S... ASSET_CODE=USDC ASSET_ISSUER=GA5... \
 *     pnpm --filter @trustliner/server start
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { configFromEnv } from "./config.js";
import { StellarOnboardingService } from "./service.js";

const service = new StellarOnboardingService(configFromEnv());
const app = createApp(service);
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port });
console.log(`Trustline Onboarder server listening on :${port}`);
