import { OnboardingError } from "@trustliner/sdk";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { OnboardingService } from "./types.js";

function errJson(c: Context, err: unknown) {
  if (err instanceof OnboardingError) {
    return c.json({ error: err.code, message: err.message }, err.httpStatus as ContentfulStatusCode);
  }
  return c.json({ error: "internal_error", message: (err as Error).message }, 500);
}

/** Build the SEP HTTP app around an onboarding service (injectable for tests). */
export function createApp(service: OnboardingService): Hono {
  const app = new Hono();
  const authRequired = service.info().authentication_required;

  // Returns a 401 Response when auth is required but missing; null to proceed.
  const authGate = (c: Context) => {
    if (!authRequired) return null;
    const header = c.req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized", message: "Missing bearer token." }, 401);
    }
    // TODO(M3+): verify the SEP-0010 JWT and that its account matches body.account.
    return null;
  };

  app.get("/info", (c) => c.json(service.info()));

  app.post("/transactions", async (c) => {
    const denied = authGate(c);
    if (denied) return denied;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return errJson(c, new OnboardingError("invalid_request", "Invalid JSON body.", 400));
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json(await service.create(body as any), 201);
    } catch (err) {
      return errJson(c, err);
    }
  });

  app.get("/transactions/:id", async (c) => {
    const denied = authGate(c);
    if (denied) return denied;
    try {
      const record = await service.get(c.req.param("id"));
      if (!record) {
        return errJson(c, new OnboardingError("invalid_request", "Unknown onboarding id.", 404));
      }
      return c.json(record);
    } catch (err) {
      return errJson(c, err);
    }
  });

  app.post("/transactions/:id/submit", async (c) => {
    const denied = authGate(c);
    if (denied) return denied;
    let body: { transaction?: string };
    try {
      body = (await c.req.json()) as { transaction?: string };
    } catch {
      return errJson(c, new OnboardingError("invalid_request", "Invalid JSON body.", 400));
    }
    if (!body.transaction) {
      return errJson(c, new OnboardingError("invalid_request", "Missing transaction.", 400));
    }
    try {
      return c.json(await service.submit(c.req.param("id"), body.transaction));
    } catch (err) {
      return errJson(c, err);
    }
  });

  return app;
}
