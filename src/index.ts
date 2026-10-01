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

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type CastaliaCredentialProfile = {
  schema: string
  [key: string]: JsonValue
}

export type CastaliaCredentialRequestV1 = {
  schema: 'castalia.credential-request.v1'
  schema_version: 1
  request_id: string
  namespace: string
  subject_public_key: string
  origin: string
  profile: CastaliaCredentialProfile
  requested_at: string
  request_expires_at: string
  nonce: string
  wallet_signature: string
}

export type CastaliaCredentialInstallV1 = {
  schema: 'castalia.credential-install.v1'
  schema_version: 1
  namespace: string
  recipient_public_key: string
  manifest: CastaliaCredentialProfile
  encrypted_secret: string
  issuer_signature: string
}

export type CastaliaCredentialUseV1 = {
  schema: 'castalia.credential-use.v1'
  schema_version: 1
  namespace: string
  audience: string
  resource: string
  method: 'GET' | 'POST'
  path: string
  required_scopes: string[]
  reason: string
}

export type CastaliaCredentialUseResultV1 = {
  schema: 'castalia.credential-use-result.v1'
  schema_version: 1
  state: 'approved' | 'denied' | 'unavailable'
  credential?: string
  credential_id?: string
  version?: number
  expires_at?: string
  reason?: string
}

export type CastaliaCredentialInstallResultV1 = {
  schema: 'castalia.credential-install-result.v1'
  schema_version: 1
  state: 'installed' | 'rejected' | 'unsupported'
  namespace: string
  credential_id?: string
  version?: number
  reason?: string
}

export type CastaliaCredentialProvider = CastaliaWalletProvider & {
  requestCredential(input: {
    namespace: string
    profile: CastaliaCredentialProfile
    request_expires_at: string
    nonce: string
  }): Promise<CastaliaCredentialRequestV1>
  installCredential(input: CastaliaCredentialInstallV1): Promise<CastaliaCredentialInstallResultV1>
  useCredential(input: CastaliaCredentialUseV1): Promise<CastaliaCredentialUseResultV1>
}

export type CastaliaCredentialProfileAdapter<TProfile extends CastaliaCredentialProfile> = {
  readonly schema: TProfile['schema']
  validate(profile: CastaliaCredentialProfile): TProfile
}

export class UnsupportedCredentialProfileError extends Error {
  readonly code = 'unsupported_profile'

  constructor() {
    super('Credential profile is not supported')
    this.name = 'UnsupportedCredentialProfileError'
  }
}

export function resolveCredentialProfile<TProfile extends CastaliaCredentialProfile>(
  profile: CastaliaCredentialProfile,
  adapters: ReadonlyArray<CastaliaCredentialProfileAdapter<TProfile>>,
): TProfile {
  if (!isRecord(profile) || typeof profile.schema !== 'string' || profile.schema.length === 0) {
    throw new UnsupportedCredentialProfileError()
  }
  const adapter = adapters.find((candidate) => candidate.schema === profile.schema)
  if (!adapter) {
    throw new UnsupportedCredentialProfileError()
  }
  return adapter.validate(profile)
}

export function assertCredentialRequestBinding(
  request: CastaliaCredentialRequestV1,
  expected: {
    namespace: string
    subject_public_key: string
    origin: string
    profile_schema: string
    now?: () => Date
  },
): void {
  if (request.schema !== 'castalia.credential-request.v1' || request.schema_version !== 1) {
    throw new Error('unsupported_version')
  }
  if (
    request.namespace !== expected.namespace ||
    request.subject_public_key !== expected.subject_public_key ||
    request.origin !== expected.origin ||
    request.profile.schema !== expected.profile_schema
  ) {
    throw new Error('request_binding_mismatch')
  }
  if (
    !request.request_id ||
    !request.nonce ||
    !request.wallet_signature ||
    !request.requested_at ||
    !request.request_expires_at
  ) {
    throw new Error('invalid_request')
  }
  const requestedAt = Date.parse(request.requested_at)
  const expiresAt = Date.parse(request.request_expires_at)
  const now = (expected.now ? expected.now() : new Date()).getTime()
  if (!Number.isFinite(requestedAt) || !Number.isFinite(expiresAt) || requestedAt >= expiresAt) {
    throw new Error('invalid_request')
  }
  if (now >= expiresAt) {
    throw new Error('credential_request_expired')
  }
}

export async function requestCredentialWithCastaliaWallet(input: {
  provider: CastaliaCredentialProvider
  namespace: string
  profile: CastaliaCredentialProfile
  request_expires_at: string
  nonce: string
}): Promise<CastaliaCredentialRequestV1> {
  if (!(await input.provider.isAvailable())) {
    throw new Error('Castalia Wallet provider is not available')
  }
  return input.provider.requestCredential({
    namespace: input.namespace,
    profile: input.profile,
    request_expires_at: input.request_expires_at,
    nonce: input.nonce,
  })
}

export async function useCredentialWithCastaliaWallet(input: {
  provider: CastaliaCredentialProvider
  request: CastaliaCredentialUseV1
}): Promise<CastaliaCredentialUseResultV1> {
  if (!(await input.provider.isAvailable())) {
    return {
      schema: 'castalia.credential-use-result.v1',
      schema_version: 1,
      state: 'unavailable',
      reason: 'provider_unavailable',
    }
  }
  const result = await input.provider.useCredential(input.request)
  if (result.state === 'approved' && (!result.credential || !result.expires_at)) {
    throw new Error('invalid_credential_use_result')
  }
  if (result.state !== 'approved' && result.credential !== undefined) {
    throw new Error('invalid_credential_use_result')
  }
  return result
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
