# Auth Buildkite qualification

The `bananawalnut` pipeline uses `linux-small` and uploads `.buildkite/pipeline.yml`. No deployment or registry publication step exists. Existing GitHub checks remain unchanged; cutover requires separate review. Disable untrusted fork builds and provide only repository read access.

Node 20.20.0 is checksum verified. The existing lockfile is installed without lifecycle scripts or auditing. Every run binds a clean checkout to the requested full commit, then checks tests, types, generated distribution, committed fixture digests and an isolated installed tarball consumer. The consumer verifies both generic-presentation signatures and fixed transcript bytes from the shipped fixtures. No sibling checkout or network package resolution is used for that consumer.

Negative tests reject altered/missing fixtures, stale or extra generated output, dirty sources and wrong revisions. The tarball, digest, tool/lock provenance and logs are retained as CI artifacts. Fixture inventory updates require explicit reviewed source changes, not automatic regeneration in CI. No public contract or signing byte changes are introduced.
