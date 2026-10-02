import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertCredentialRequestBinding,
  authenticateWithCastaliaWallet,
  createWalletAuthChallenge,
  requestCredentialWithCastaliaWallet,
  resolveCredentialProfile,
  UnsupportedCredentialProfileError,
  useCredentialWithCastaliaWallet,
  type CastaliaCredentialProfile,
  type CastaliaCredentialProfileAdapter,
  type CastaliaCredentialProvider,
  type CastaliaCredentialRequestV1,
  verifyWalletPresentation,
  type CastaliaWalletProvider,
} from '../src/index.ts'

const fixedNow = () => new Date('2026-05-28T20:00:00.000Z')

test('createWalletAuthChallenge binds nonce, origin, audience, operation, and expiry', () => {
  const challenge = createWalletAuthChallenge({
    nonce: 'nonce-123',
    origin: 'http://localhost:5173',
    audience: 'zenith-review-sdk',
    now: fixedNow,
    ttlMs: 300_000,
  })

  assert.equal(challenge.domain, 'castalia-wallet')
  assert.equal(challenge.version, 1)
  assert.equal(challenge.nonce, 'nonce-123')
  assert.equal(challenge.origin, 'http://localhost:5173')
  assert.equal(challenge.audience, 'zenith-review-sdk')
  assert.equal(challenge.operation, 'castalia.wallet.signChallenge')
  assert.equal(challenge.issuedAt, '2026-05-28T20:00:00.000Z')
  assert.equal(challenge.expiresAt, '2026-05-28T20:05:00.000Z')
})

test('verifyWalletPresentation rejects mismatched challenge fields', () => {
  const challenge = createWalletAuthChallenge({
    nonce: 'nonce-123',
    origin: 'http://localhost:5173',
    audience: 'zenith-review-sdk',
    now: fixedNow,
  })

  assert.throws(() => verifyWalletPresentation({
    presentation: {
      subject: { subjectId: 'subject-1', publicKey: 'public-key', walletKind: 'castalia-dregg' },
      challenge: { ...challenge, origin: 'https://evil.example' },
      signature: 'sig',
      signatureAlgorithm: 'node-ed25519',
    },
    expectedChallenge: challenge,
    verifySignature: () => true,
  }), /origin/)
})

test('verifyWalletPresentation rejects expired challenges', () => {
  const challenge = createWalletAuthChallenge({
    nonce: 'nonce-123',
    origin: 'http://localhost:5173',
    audience: 'zenith-review-sdk',
    now: fixedNow,
    ttlMs: 1,
  })

  assert.throws(() => verifyWalletPresentation({
    presentation: {
      subject: { subjectId: 'subject-1', publicKey: 'public-key', walletKind: 'castalia-dregg' },
      challenge,
      signature: 'sig',
      signatureAlgorithm: 'node-ed25519',
    },
    expectedChallenge: challenge,
    verifySignature: () => true,
    now: () => new Date('2026-05-28T20:00:01.000Z'),
  }), /expired/)
})

test('verifyWalletPresentation invokes signature verifier with expected public key, challenge, and signature', () => {
  const challenge = createWalletAuthChallenge({
    nonce: 'nonce-123',
    origin: 'http://localhost:5173',
    audience: 'zenith-review-sdk',
    now: fixedNow,
  })

  const verified = verifyWalletPresentation({
    presentation: {
      subject: { subjectId: 'subject-1', publicKey: 'public-key', walletKind: 'castalia-dregg' },
      challenge,
      signature: 'sig',
      signatureAlgorithm: 'node-ed25519',
    },
    expectedChallenge: challenge,
    now: fixedNow,
    verifySignature: ({ publicKey, challenge: actualChallenge, signature }) => {
      assert.equal(publicKey, 'public-key')
      assert.equal(actualChallenge, challenge)
      assert.equal(signature, 'sig')
      return true
    },
  })

  assert.equal(verified.subjectId, 'subject-1')
  assert.equal(verified.publicKey, 'public-key')
})

test('authenticateWithCastaliaWallet is opt-in and calls provider signChallenge', async () => {
  const challenge = createWalletAuthChallenge({
    nonce: 'nonce-123',
    origin: 'http://localhost:5173',
    audience: 'zenith-review-sdk',
    now: fixedNow,
  })

  const provider: CastaliaWalletProvider = {
    async isAvailable() { return true },
    async getSubject() {
      return { subjectId: 'subject-1', publicKey: 'public-key', walletKind: 'castalia-dregg' }
    },
    async signChallenge(input) {
      assert.deepEqual(input, challenge)
      return {
        subject: { subjectId: 'subject-1', publicKey: 'public-key', walletKind: 'castalia-dregg' },
        challenge: input,
        signature: 'sig',
        signatureAlgorithm: 'node-ed25519',
      }
    },
  }

  const result = await authenticateWithCastaliaWallet({
    provider,
    challenge,
    now: fixedNow,
    verifySignature: () => true,
  })

  assert.equal(result.subjectId, 'subject-1')
})

test('authenticateWithCastaliaWallet fails closed when provider is unavailable', async () => {
  const provider: CastaliaWalletProvider = {
    async isAvailable() { return false },
    async getSubject() { throw new Error('should not be called') },
    async signChallenge() { throw new Error('should not be called') },
  }

  await assert.rejects(() => authenticateWithCastaliaWallet({
    provider,
    challenge: createWalletAuthChallenge({
      nonce: 'nonce-123',
      origin: 'http://localhost:5173',
      audience: 'zenith-review-sdk',
      now: fixedNow,
    }),
    verifySignature: () => true,
  }), /not available/)
})

const profile: CastaliaCredentialProfile & {
  schema: 'devgraph.credential-request-profile.v1'
} = {
  schema: 'devgraph.credential-request-profile.v1',
  issuer: 'devgraph-owner-local-v1',
  audience: 'devgraph',
  resource: 'https://work.zenith-research.ca/devgraph',
  requested_scopes: ['devgraph.work.read'],
  requested_grants: [{ scope: 'devgraph.work.read' }],
  reason: 'Read delegated Devgraph Work data',
}

const adapter: CastaliaCredentialProfileAdapter<typeof profile> = {
  schema: profile.schema,
  validate(value) {
    if (value.schema !== profile.schema || value.audience !== 'devgraph') {
      throw new Error('invalid Devgraph profile')
    }
    return value as typeof profile
  },
}

function credentialRequest(): CastaliaCredentialRequestV1 {
  return {
    schema: 'castalia.credential-request.v1',
    schema_version: 1,
    request_id: 'crq-test',
    namespace: 'zenith:devgraph',
    subject_public_key: 'subject-key',
    origin: 'https://work.zenith-research.ca',
    profile,
    requested_at: '2026-10-01T00:00:00.000Z',
    request_expires_at: '2026-10-01T00:05:00.000Z',
    nonce: 'nonce',
    wallet_signature: 'signature',
  }
}

test('profile dispatch is explicit and unknown profiles fail closed', () => {
  assert.equal(resolveCredentialProfile(profile, [adapter]), profile)
  assert.throws(
    () => resolveCredentialProfile({ schema: 'unknown.profile.v1' }, [adapter]),
    (error) => error instanceof UnsupportedCredentialProfileError && error.code === 'unsupported_profile',
  )
})

test('credential request binding covers subject, trusted origin, namespace, profile, and expiry', () => {
  const request = credentialRequest()
  const expected = {
    namespace: 'zenith:devgraph',
    subject_public_key: 'subject-key',
    origin: 'https://work.zenith-research.ca',
    profile_schema: profile.schema,
    now: () => new Date('2026-10-01T00:01:00.000Z'),
  }
  assert.doesNotThrow(() => assertCredentialRequestBinding(request, expected))
  assert.throws(
    () => assertCredentialRequestBinding({ ...request, origin: 'https://evil.example' }, expected),
    /request_binding_mismatch/,
  )
  assert.throws(
    () => assertCredentialRequestBinding(request, {
      ...expected,
      now: () => new Date('2026-10-01T00:05:00.000Z'),
    }),
    /credential_request_expired/,
  )
})

test('credential provider methods are additive and approved use requires bounded authority', async () => {
  const provider: CastaliaCredentialProvider = {
    async isAvailable() { return true },
    async getSubject() {
      return { subjectId: 'subject-1', publicKey: 'subject-key', walletKind: 'castalia-dregg' }
    },
    async signChallenge() { throw new Error('not used') },
    async requestCredential(input) {
      assert.equal(input.namespace, 'zenith:devgraph')
      return credentialRequest()
    },
    async installCredential(input) {
      return {
        schema: 'castalia.credential-install-result.v1',
        schema_version: 1,
        state: 'installed',
        namespace: input.namespace,
      }
    },
    async useCredential(input) {
      assert.equal(input.path, '/devgraph/work/Issue')
      return {
        schema: 'castalia.credential-use-result.v1',
        schema_version: 1,
        state: 'approved',
        credential: 'memory-only-test-authority',
        expires_at: '2026-10-01T00:05:00.000Z',
      }
    },
  }
  const requested = await requestCredentialWithCastaliaWallet({
    provider,
    namespace: 'zenith:devgraph',
    profile,
    request_expires_at: '2026-10-01T00:05:00.000Z',
    nonce: 'nonce',
  })
  assert.equal(requested.request_id, 'crq-test')

  const used = await useCredentialWithCastaliaWallet({
    provider,
    request: {
      schema: 'castalia.credential-use.v1',
      schema_version: 1,
      namespace: 'zenith:devgraph',
      audience: 'devgraph',
      resource: 'https://work.zenith-research.ca/devgraph',
      method: 'GET',
      path: '/devgraph/work/Issue',
      required_scopes: ['devgraph.work.read'],
      reason: 'List visible issues',
    },
  })
  assert.equal(used.state, 'approved')
})

test('credential use rejects secret material on denied results', async () => {
  const provider = {
    async isAvailable() { return true },
    async useCredential() {
      return {
        schema: 'castalia.credential-use-result.v1' as const,
        schema_version: 1 as const,
        state: 'denied' as const,
        credential: 'must-not-leak',
      }
    },
  } as Pick<CastaliaCredentialProvider, 'isAvailable' | 'useCredential'>

  await assert.rejects(
    () => useCredentialWithCastaliaWallet({
      provider: provider as CastaliaCredentialProvider,
      request: {
        schema: 'castalia.credential-use.v1',
        schema_version: 1,
        namespace: 'zenith:devgraph',
        audience: 'devgraph',
        resource: 'https://work.zenith-research.ca/devgraph',
        method: 'GET',
        path: '/devgraph/graph',
        required_scopes: ['devgraph.graph.read'],
        reason: 'Read graph',
      },
    }),
    /invalid_credential_use_result/,
  )
})


test('credential use rejects malformed or unsupported provider results', async () => {
  const approved = {
    schema: 'castalia.credential-use-result.v1', schema_version: 1,
    state: 'approved', credential: 'synthetic-test-authority',
    expires_at: '2026-10-01T00:05:00.000Z',
  }
  const invalid = [
    null, { ...approved, schema: 'future.result.v2' },
    { ...approved, schema_version: 2 }, { ...approved, state: 'unknown', credential: undefined },
    { ...approved, expires_at: 'invalid' }, { ...approved, credential: 42 },
    { ...approved, credential: '   ' },
  ]
  for (const result of invalid) {
    const provider = {
      async isAvailable() { return true },
      async useCredential() { return result },
    } as unknown as CastaliaCredentialProvider
    await assert.rejects(() => useCredentialWithCastaliaWallet({
      provider,
      request: {
        schema: 'castalia.credential-use.v1', schema_version: 1,
        namespace: 'zenith:devgraph', audience: 'devgraph',
        resource: 'https://work.zenith-research.ca/devgraph', method: 'GET',
        path: '/devgraph/graph', required_scopes: ['devgraph.graph.read'], reason: 'Read graph',
      },
    }), /invalid_credential_use_result/)
  }
})

test('credential request binding rejects malformed fields and invalid clocks', () => {
  const expected = {
    namespace: 'zenith:devgraph', subject_public_key: 'subject-key',
    origin: 'https://work.zenith-research.ca', profile_schema: profile.schema,
    now: () => new Date('2026-10-01T00:01:00.000Z'),
  }
  for (const patch of [{ profile: null }, { nonce: 1 }, { request_id: '   ' }, { wallet_signature: {} }]) {
    assert.throws(() => assertCredentialRequestBinding(
      { ...credentialRequest(), ...patch } as unknown as CastaliaCredentialRequestV1, expected,
    ), /invalid_request/)
  }
  assert.throws(() => assertCredentialRequestBinding(credentialRequest(), {
    ...expected, now: () => new Date(Number.NaN),
  }), /invalid_request/)
})
