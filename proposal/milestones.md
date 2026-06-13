# Milestones

Clear, testable delivery milestones for Trustline Onboarder. Each milestone has an
outcome, acceptance criteria, and the deliverables it unlocks. Tranche mapping is a
proposal; final tranche structure is agreed with SCF reviewers.

---

## M1 — Standard draft v0.1

**Outcome:** A published, reviewable specification of the onboarding standard.

**Acceptance criteria**
- SEP draft in [`standard/`](../standard) covering: handshake message formats,
  endpoints, signing, sponsored-reserve + claimable-balance flow, error semantics.
- Rationale document comparing design alternatives (authorize-trustline interface,
  intermediary accounts, claimable balances) with trade-offs.
- Security considerations section.
- Public RFC opened for community feedback.

**Deliverable:** Published standard (SEP format).

---

## M2 — Reference implementation

**Outcome:** Working issuer and recipient flows on Stellar testnet.

**Acceptance criteria**
- Issuer/sender flow: sponsor reserves + create claimable balance for a recipient with
  zero XLM and no trustline.
- Recipient flow: claim and hold the asset on first interaction.
- End-to-end test against testnet, reproducible via a single command.
- Handles failure/edge cases (already-onboarded, insufficient sponsor balance, reclaim).

**Deliverable:** Reference implementation with issuer and recipient flows.

---

## M3 — SDK alpha

**Outcome:** A minimal TypeScript SDK that wallets and exchanges can integrate.

**Acceptance criteria**
- Typed API for both sender and recipient sides of the handshake.
- Builds transactions; never custodies keys (caller signs).
- Published to npm under `@trustliner/sdk` (alpha tag).
- Unit + integration tests; documented public API.

**Deliverable:** SDK / libraries for wallet and exchange integration.

---

## M4 — Landing page + documentation

**Outcome:** Onboarding UX and integrator docs.

**Acceptance criteria**
- "Welcome to Stellar" landing page demonstrating a real trustline-free onboarding.
- Integration guides for wallets and exchanges in [`docs/`](../docs).
- Example integration(s) wired to the SDK.

**Deliverable:** "Welcome to Stellar" landing page; documentation; example integrations.

---

## M5 — Production-ready

**Outcome:** Mainnet-ready, hardened, adopted.

**Acceptance criteria**
- Mainnet support with the latest stable Stellar release.
- Full test suite (unit + integration) green in CI.
- Security review of the flow and reference code; findings resolved.
- Standard advanced through the SEP process (review-ready).
- At least one wallet or exchange integration commitment.
- Maintenance plan operational (versioning, CI, disclosure policy).

**Deliverable:** Production-ready version.

---

## Tranche mapping (proposed)

| Tranche | Milestones |
| --- | --- |
| 1 | M1 + M2 |
| 2 | M3 + M4 |
| 3 | M5 |
