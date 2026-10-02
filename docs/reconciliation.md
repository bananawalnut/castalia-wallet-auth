# Credential profile reconciliation

Source: `120ab534091532638b6ece2db4846b3200213af7`, reconciled onto `0f60793aa50347adbcd41113854c9e71c00fc788`.

This additive contract retains all original authentication interfaces. Product-owned profiles remain opaque to this package except for explicit adapter dispatch. Helpers reject unsupported result envelopes, malformed authority values and invalid clocks; they do not verify signatures or grant product authorization.

Validation on 2026-10-02: Node 24.18.0; 12 tests passed (including two regressions first observed failing), TypeScript typecheck and distribution build passed. Generated declarations remain additive. Receiver-side policy/expiry checks and actual Wallet profile custody remain separate integration gates.
