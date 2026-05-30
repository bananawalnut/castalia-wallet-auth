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
