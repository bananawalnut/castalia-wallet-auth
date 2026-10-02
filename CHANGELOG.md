# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Add generic credential request, installation and use interfaces — keep product policy separate from Wallet custody while retaining the authentication API.
- Initial standalone Castalia Wallet Auth package extracted from the Review SDK integration seam.
- Provider contract, challenge creation, signature-presentation verification, and tests.

### Fixed
- Reject malformed credential requests and provider responses — prevent unsupported versions, invalid expiry values and unknown states from being accepted as authority.
