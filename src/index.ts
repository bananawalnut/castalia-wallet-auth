export type CastaliaWalletKind = 'castalia-dregg'

export type CastaliaWalletOperation = 'castalia.wallet.signChallenge'

export type CastaliaWalletChallenge = {
  domain: 'castalia-wallet'
  version: 1
  nonce: string
  origin: string
  audience: string
  operation: CastaliaWalletOperation
  issuedAt: string
  expiresAt: string
}

export type CastaliaWalletSubject = {
  subjectId: string
  publicKey: string
  walletKind: CastaliaWalletKind
}

export type CastaliaWalletSignaturePresentation = {
  subject: CastaliaWalletSubject
  challenge: CastaliaWalletChallenge
  signature: string
  signatureAlgorithm: 'ed25519' | 'node-ed25519'
}

export type CastaliaWalletProvider = {
  isAvailable(): Promise<boolean>
  getSubject(): Promise<CastaliaWalletSubject>
  signChallenge(input: CastaliaWalletChallenge): Promise<CastaliaWalletSignaturePresentation>
}

export type CreateWalletAuthChallengeInput = {
  nonce: string
  origin: string
  audience: string
  now?: () => Date
  ttlMs?: number
}

export type VerifyWalletPresentationInput = {
  presentation: CastaliaWalletSignaturePresentation
  expectedChallenge: CastaliaWalletChallenge
  now?: () => Date
  verifySignature(input: {
    publicKey: string
    challenge: CastaliaWalletChallenge
    signature: string
  }): boolean
}

export type VerifiedWalletPresentation = {
  subjectId: string
  publicKey: string
  walletKind: CastaliaWalletKind
  challenge: CastaliaWalletChallenge
}

export type AuthenticateWithCastaliaWalletInput = {
  provider: CastaliaWalletProvider
  challenge: CastaliaWalletChallenge
  now?: VerifyWalletPresentationInput['now']
  verifySignature: VerifyWalletPresentationInput['verifySignature']
}

export function createWalletAuthChallenge(input: CreateWalletAuthChallengeInput): CastaliaWalletChallenge {
  const now = input.now ? input.now() : new Date()
  const ttlMs = input.ttlMs ?? 300_000
  const expiresAt = new Date(now.getTime() + ttlMs)

  if (!input.nonce || input.nonce.trim().length === 0) {
    throw new Error('wallet auth challenge nonce is required')
  }

  if (!input.origin || input.origin.trim().length === 0) {
    throw new Error('wallet auth challenge origin is required')
  }

  if (!input.audience || input.audience.trim().length === 0) {
    throw new Error('wallet auth challenge audience is required')
  }

  return {
    domain: 'castalia-wallet',
    version: 1,
    nonce: input.nonce,
    origin: input.origin,
    audience: input.audience,
    operation: 'castalia.wallet.signChallenge',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

export async function authenticateWithCastaliaWallet(
  input: AuthenticateWithCastaliaWalletInput,
): Promise<VerifiedWalletPresentation> {
  const available = await input.provider.isAvailable()
  if (!available) {
    throw new Error('Castalia Wallet provider is not available')
  }

  const presentation = await input.provider.signChallenge(input.challenge)
  return verifyWalletPresentation({
    presentation,
    expectedChallenge: input.challenge,
    now: input.now,
    verifySignature: input.verifySignature,
  })
}

export function verifyWalletPresentation(
  input: VerifyWalletPresentationInput,
): VerifiedWalletPresentation {
  assertChallengeMatches(input.presentation.challenge, input.expectedChallenge)
  assertChallengeFresh(input.expectedChallenge, input.now ? input.now() : new Date())

  const verified = input.verifySignature({
    publicKey: input.presentation.subject.publicKey,
    challenge: input.expectedChallenge,
    signature: input.presentation.signature,
  })

  if (!verified) {
    throw new Error('Castalia Wallet signature verification failed')
  }

  return {
    subjectId: input.presentation.subject.subjectId,
    publicKey: input.presentation.subject.publicKey,
    walletKind: input.presentation.subject.walletKind,
    challenge: input.expectedChallenge,
  }
}

function assertChallengeFresh(challenge: CastaliaWalletChallenge, now: Date): void {
  const expiresAt = Date.parse(challenge.expiresAt)
  if (!Number.isFinite(expiresAt)) {
    throw new Error('Castalia Wallet challenge expiresAt is invalid')
  }
  if (now.getTime() > expiresAt) {
    throw new Error('Castalia Wallet challenge expired')
  }
}

function assertChallengeMatches(actual: CastaliaWalletChallenge, expected: CastaliaWalletChallenge): void {
  const fields: Array<keyof CastaliaWalletChallenge> = [
    'domain',
    'version',
    'nonce',
    'origin',
    'audience',
    'operation',
    'issuedAt',
    'expiresAt',
  ]

  for (const field of fields) {
    if (actual[field] !== expected[field]) {
      throw new Error(`Castalia Wallet challenge ${field} mismatch`)
    }
  }
}

