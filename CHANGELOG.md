# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Add exact-head Buildkite package qualification — verify fixed fixtures, generated output and isolated packed exports without changing required GitHub checks.

- Bounded runtime provider profiles and a multi-issuer membership catalog — keep connection, trust purposes and receiving-service eligibility separate without changing signed bytes or recovery.

- Generic credential-bound presentation v2 types and fixed transcript helpers — let applications own their operations while Wallet verifies and approves each request.

- Add pinned, read-only pull-request CI — require contract, type and distribution checks before accepting profile-contract changes.
- Add generic credential request, installation and use interfaces — keep product policy separate from Wallet custody while retaining the authentication API.
- Initial standalone Castalia Wallet Auth package extracted from the Review SDK integration seam.
- Provider contract, challenge creation, signature-presentation verification, and tests.

### Fixed
- Build Auth into an empty staging tree and compare the complete generated distribution — committed obsolete modules must fail CI and cannot survive prepack.
- Reject sparse canonical arrays and malformed provider results — prevent structural validation from admitting data that the custody contract rejects.
- Reject malformed credential requests and provider responses — prevent unsupported versions, invalid expiry values and unknown states from being accepted as authority.
