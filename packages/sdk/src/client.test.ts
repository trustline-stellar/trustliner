import { describe, expect, it } from "vitest";
import {
  fetchInfo,
  OnboardingError,
  requestOnboarding,
  resolveOnboarderServer,
  type InfoResponse,
} from "./client.js";

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const info: InfoResponse = {
  assets: [
    { code: "USDC", issuer: "GA5", min_amount: "1", max_amount: "1000", enabled: true },
  ],
  account_creation: "funded",
  authentication_required: false,
  claim_window_seconds: 604800,
};

describe("client: discovery", () => {
  it("parses TRUSTLINE_ONBOARDER_SERVER from stellar.toml", async () => {
    const fakeFetch = async () =>
      new Response(
        'NETWORK_PASSPHRASE="x"\nTRUSTLINE_ONBOARDER_SERVER="https://onboard.example.com/"\n',
        { status: 200 },
      );
    const url = await resolveOnboarderServer("example.com", { fetch: fakeFetch as typeof fetch });
    expect(url).toBe("https://onboard.example.com");
  });

  it("returns null when the field is absent", async () => {
    const fakeFetch = async () => new Response('FOO="bar"', { status: 200 });
    const url = await resolveOnboarderServer("example.com", { fetch: fakeFetch as typeof fetch });
    expect(url).toBeNull();
  });
});

describe("client: info", () => {
  it("fetches and returns capabilities", async () => {
    const fakeFetch = async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://s.example.com/info");
      return json(info);
    };
    const got = await fetchInfo("https://s.example.com/", { fetch: fakeFetch as typeof fetch });
    expect(got.account_creation).toBe("funded");
    expect(got.assets[0]?.code).toBe("USDC");
  });
});

describe("client: requestOnboarding", () => {
  it("posts the body and returns the claim transaction", async () => {
    const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://s.example.com/transactions");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body)).amount).toBe("25");
      return json({ id: "abc", status: "pending_claim", claim_transaction: "XDR==" }, 201);
    };
    const res = await requestOnboarding(
      "https://s.example.com",
      { account: "GBQ", asset_code: "USDC", asset_issuer: "GA5", amount: "25" },
      { fetch: fakeFetch as typeof fetch },
    );
    expect(res.id).toBe("abc");
    expect(res.claim_transaction).toBe("XDR==");
  });

  it("maps a JSON error body to a typed OnboardingError", async () => {
    const fakeFetch = async () =>
      json({ error: "already_onboarded", message: "holds USDC" }, 409);
    await expect(
      requestOnboarding(
        "https://s.example.com",
        { account: "GBQ", asset_code: "USDC", asset_issuer: "GA5", amount: "25" },
        { fetch: fakeFetch as typeof fetch },
      ),
    ).rejects.toMatchObject({
      name: "OnboardingError",
      code: "already_onboarded",
      httpStatus: 409,
    });
  });

  it("OnboardingError carries code + status", () => {
    const e = new OnboardingError("asset_not_supported", "nope", 403);
    expect(e.code).toBe("asset_not_supported");
    expect(e.httpStatus).toBe(403);
  });
});
