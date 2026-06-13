# Fit & track record

## Team

| Name | Role | Relevant background |
| --- | --- | --- |
| Cédric Magne | Lead Developer | Senior Full Stack Engineer, 12+ years; former CTO on large-scale platforms; Consensys alumni (MetaMask, Infura); DeFi protocol engineering & smart contract development |

LinkedIn: [linkedin.com/in/cedricmagne](https://linkedin.com/in/cedricmagne)

## Why this team fits this RFP

Cédric's years at Consensys — engineering on protocols underpinning MetaMask and Infura — gave him direct, production-scale experience with the same class of problems Trustline Onboarder solves: onboarding friction, reserve management, and SDK design for developer ecosystems. DeFi protocol work at that level requires exactly the primitives this SEP composes: escrow mechanics, sponsored accounts, and interoperability standards. His CTO background means the project ships with architecture discipline and maintenance habits from day one, not retrofitted after launch.

## Prior dev-focused work

- **Trustline Onboarder** — this project; open-source under Apache-2.0: [github.com/cedricmagne/trustline-onboarder](https://github.com/cedricmagne/trustline-onboarder)
- **Consensys / MetaMask ecosystem** — contributor during tenure at Consensys, one of the primary Ethereum infrastructure companies; work covered smart contract tooling, DeFi protocol integrations, and developer-facing SDKs

## Stellar-specific experience

- Hands-on implementation of sponsored reserves (CAP-33) and claimable balances (CAP-23) as the core settlement mechanism for this project — verified against Stellar testnet
- Authored the SEP draft defining the trustline-free onboarding handshake, following SEP-0006/SEP-0024 conventions for HTTP resource shape and status semantics
- Integrated `@stellar/stellar-sdk` (latest stable) for transaction construction; architecture is Horizon/RPC endpoint-agnostic
- Designed the standard to compose existing Stellar primitives with no protocol change required, demonstrating working knowledge of the CAP landscape

## Evidence of ability to ship & maintain

- 12+ years of continuous software delivery across full-stack and infrastructure roles
- CTO experience managing codebases and teams on large-scale production platforms
- Consensys tenure demonstrates ability to work on open protocol standards alongside distributed teams and public developer communities
- This project: Apache-2.0, pnpm workspaces, Vitest, TypeScript strict mode, GitHub Actions CI, semantic versioning — standard open-source maintenance practices applied from the first commit
