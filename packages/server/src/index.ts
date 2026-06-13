/**
 * @trustliner/server
 *
 * SEP-conformant onboarding server (sender side). Compose {@link createApp} with an
 * {@link OnboardingService} ({@link StellarOnboardingService} for the real thing).
 *
 * @see ../../standard/sep-draft.md
 */

export { createApp } from "./app.js";
export { StellarOnboardingService } from "./service.js";
export { configFromEnv } from "./config.js";
export { MemoryStore, type OnboardingRecord } from "./store.js";
export type { OnboardingService, ServerConfig, ServerAsset } from "./types.js";
