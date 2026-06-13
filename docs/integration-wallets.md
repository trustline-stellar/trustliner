# Wallet integration guide

> 🚧 Drafted in milestone **M4**.

How a wallet adopts Trustline Onboarder to let users receive non-native assets without
holding XLM or pre-configuring a trustline.

Outline:
1. Install `@trustliner/sdk`.
2. Discover senders that advertise onboarding support.
3. Initiate the handshake on the recipient's behalf.
4. Claim the escrowed asset on first interaction (recipient signs).
5. UX recommendations and error handling.
