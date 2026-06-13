# Exchange integration guide

> 🚧 Drafted in milestone **M4**.

How an exchange adopts Trustline Onboarder to withdraw non-native assets to users who
have not set up a trustline.

Outline:
1. Install `@trustliner/sdk`.
2. Advertise onboarding support (discovery).
3. Authorize incoming onboarding requests.
4. Build and sign the sponsored settlement (sponsor reserves + claimable balance).
5. Reclaim path for abandoned onboarding.
6. Compliance and limits.
