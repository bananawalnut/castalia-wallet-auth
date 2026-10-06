#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(git rev-parse --show-toplevel)"
[[ "${BUILDKITE:-}" == true && "$(uname -s)-$(uname -m)" == Linux-x86_64 ]] || { echo 'Hosted Linux Buildkite context required' >&2; exit 1; }
[[ "${BUILDKITE_COMMIT:-}" =~ ^[a-f0-9]{40}$ && "$(git rev-parse HEAD)" == "$BUILDKITE_COMMIT" && -z "$(git status --porcelain)" ]] || { echo 'Clean exact source required' >&2; exit 1; }
auth_ci_tools=$(mktemp -d)
trap 'rm -rf -- "$auth_ci_tools"' EXIT
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' https://nodejs.org/dist/v20.20.0/node-v20.20.0-linux-x64.tar.xz -o "$auth_ci_tools/node.tar.xz"
printf '%s  %s\n' 4f48b52acf42130844a3a75e94da0e9629009d09e4101b2304895c24f3fbe609 "$auth_ci_tools/node.tar.xz" | sha256sum --check
mkdir "$auth_ci_tools/node"
tar -xJf "$auth_ci_tools/node.tar.xz" -C "$auth_ci_tools/node" --strip-components=1
export PATH="$auth_ci_tools/node/bin:$PATH" npm_config_audit=false npm_config_fund=false
[[ "$(node --version)" == v20.20.0 ]]
node scripts/check-ci.mjs source
mkdir -p .ci-output
exec > >(tee .ci-output/checks.log) 2>&1
{ git rev-parse HEAD; node --version; npm --version; sha256sum package-lock.json scripts/fixture-digests.json; } > .ci-output/provenance.txt
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/ci-contract.test.mjs
npm test
npm run typecheck
npm run build
node scripts/check-ci.mjs dist
node scripts/check-ci.mjs fixtures
npm pack --ignore-scripts --json --pack-destination .ci-output > .ci-output/pack.json
package_file=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.ci-output/pack.json'))[0].filename)")
package_path="$PWD/.ci-output/$package_file"
consumer_script="$PWD/scripts/packed-consumer.mjs"
mkdir "$auth_ci_tools/consumer"
(
 cd "$auth_ci_tools/consumer"
 printf '%s\n' '{"private":true,"type":"module"}' > package.json
 npm install --offline --ignore-scripts --no-audit --no-fund "$package_path"
 node "$consumer_script"
)
sha256sum "$package_path" > .ci-output/package.sha256
node scripts/check-ci.mjs source
