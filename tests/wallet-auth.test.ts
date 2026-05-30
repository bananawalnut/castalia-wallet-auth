import assert from 'node:assert/strict'
import test from 'node:test'
import {
  authenticateWithCastaliaWallet,
  createWalletAuthChallenge,
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

