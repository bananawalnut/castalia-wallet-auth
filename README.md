# Castalia Wallet Auth

Provider contract and challenge verification helpers for authenticating with Castalia Wallet.

This package is not the Castalia Wallet itself. The wallet product owns wallet containers, key/account UX, provider injection, and concrete wallet implementations such as the Chrome extension. This package only defines the browser-facing auth seam that other products can use to request and verify wallet proof-of-possession.

## Boundary

- Castalia Wallet: the wallet container/product.
- Castalia Wallet Auth: challenge, provider, and signature-presentation contract.
- Zenith Review SDK: review recording/submission client that may consume a verified wallet-auth result, but does not implement the wallet.

## Usage

```ts
import { authenticateWithCastaliaWallet, createWalletAuthChallenge } from '@castalia/wallet-auth'

const challenge = createWalletAuthChallenge({
  nonce,
  origin: window.location.origin,
  audience: 'zenith-review-sdk',
})

const verified = await authenticateWithCastaliaWallet({
  provider: window.castaliaWallet,
  challenge,
  verifySignature,
})
```

The provider must be supplied by the wallet implementation, for example a browser extension bridge. `verifyWalletPresentation` rejects expired challenges before delegating to the caller-supplied signature verifier.

The additive credential API exposes generic request, install, and use envelopes without assigning meaning to product-owned profile fields. A Wallet implementation installs explicit profile adapters and must return `unsupported_profile` for every unknown schema or version. Existing challenge authentication remains unchanged. Approved use material is returned only for a bounded method, path, audience, resource, and scope request; callers must retain it in memory only.

Credential helpers validate the generic envelope and dispatch profile validation to the supplied adapter. They do not verify wallet signatures, authorize product operations, or replace receiver-side expiry and policy checks. Unknown result versions and malformed authority values are rejected.

## Credential-bound presentation v2

`CredentialPresentationProvider` advertises `credential_presentation_v2` and accepts an attached issuer credential with an opaque exact request and signed disclosure. Approval is per use. The wallet signs a fixed generic transcript; applications retain request semantics and execution. See [the versioned contract](docs/credential-presentation-v2.md). Structural helpers are not cryptographic verification or authorization.
