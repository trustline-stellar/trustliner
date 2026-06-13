import { OnboardingError, type InfoResponse } from "@trustliner/sdk";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { OnboardingService } from "./types.js";

const info: InfoResponse = {
  assets: [{ code: "USDC", issuer: "GA5", min_amount: "1", max_amount: "1000", enabled: true }],
  account_creation: "funded",
  authentication_required: false,
  claim_window_seconds: 1000,
};

const fakeService = (overrides: Partial<OnboardingService> = {}): OnboardingService => ({
  info: () => info,
  create: async (body) => {
    if (body.amount === "999") throw new OnboardingError("amount_out_of_range", "too big", 403);
    return { id: "tx1", status: "pending_claim", claim_transaction: "XDR==" };
  },
  get: async (id) => (id === "tx1" ? { id, status: "completed" } : undefined),
  submit: async (id) => ({ id, status: "completed", claim_tx_hash: "hash1" }),
  ...overrides,
});

describe("server: GET /info", () => {
  it("returns capabilities", async () => {
    const app = createApp(fakeService());
    const res = await app.request("/info");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ account_creation: "funded" });
  });
});

describe("server: POST /transactions", () => {
  it("returns 201 with a claim transaction", async () => {
    const app = createApp(fakeService());
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: "GBQ", asset_code: "USDC", asset_issuer: "GA5", amount: "10" }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "tx1", claim_transaction: "XDR==" });
  });

  it("maps OnboardingError to its HTTP status + code", async () => {
    const app = createApp(fakeService());
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: "GBQ", asset_code: "USDC", asset_issuer: "GA5", amount: "999" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "amount_out_of_range" });
  });

  it("rejects invalid JSON with 400", async () => {
    const app = createApp(fakeService());
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_request" });
  });
});

describe("server: GET /transactions/:id", () => {
  it("returns the record", async () => {
    const app = createApp(fakeService());
    const res = await app.request("/transactions/tx1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "completed" });
  });

  it("404s an unknown id", async () => {
    const app = createApp(fakeService());
    const res = await app.request("/transactions/nope");
    expect(res.status).toBe(404);
  });
});

describe("server: auth gate", () => {
  it("401s when auth is required and no bearer token is sent", async () => {
    const app = createApp(
      fakeService({ info: () => ({ ...info, authentication_required: true }) }),
    );
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: "GBQ", asset_code: "USDC", asset_issuer: "GA5", amount: "10" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });
});
