# Maintenance plan

Post-launch sustainability strategy for Trustline Onboarder.

## Standard

- Stewarded through the official **Stellar SEP process**: the draft is advanced for
  review, iterated on community feedback, and maintained as the canonical spec.
- Versioned; breaking changes documented with migration notes.

## Code (SDK + reference)

- SDK published to **npm** under `@trustliner/*` with **semantic versioning**.
- **CI** (GitHub Actions): lint, typecheck, unit + integration tests on every PR.
- Public issue tracker with triage labels and response targets.
- Changelog maintained per release.

## Security

- `SECURITY.md` with a private disclosure channel and response SLA.
- Dependency updates monitored (automated alerts) and patched.
- The production milestone includes a security review; findings tracked to resolution.

## Sustainability

- Low fixed running cost by design: the standard and SDK are static artifacts; the
  reference flow runs against public Horizon/RPC with no bespoke backend.
- Ongoing maintenance funded through a combination of: integrator support engagements,
  follow-on ecosystem grants where scope expands, and community contribution (the repo
  is built in the open under Apache-2.0).

## Governance

- Built in the open. Contribution guidelines in [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
- Decisions and roadmap discussed publicly in repository discussions and SCF channels.
