export class UnsupportedCredentialProfileError extends Error {
    code = 'unsupported_profile';
    constructor() {
        super('Credential profile is not supported');
        this.name = 'UnsupportedCredentialProfileError';
    }
}
export function resolveCredentialProfile(profile, adapters) {
    if (!isRecord(profile) || typeof profile.schema !== 'string' || profile.schema.length === 0) {
        throw new UnsupportedCredentialProfileError();
    }
    const adapter = adapters.find((candidate) => candidate.schema === profile.schema);
    if (!adapter) {
        throw new UnsupportedCredentialProfileError();
    }
    return adapter.validate(profile);
}
export function assertCredentialRequestBinding(request, expected) {
    if (!isRecord(request) || !isRecord(request.profile)) {
        throw new Error('invalid_request');
    }
    if (request.schema !== 'castalia.credential-request.v1' || request.schema_version !== 1) {
        throw new Error('unsupported_version');
    }
    if (request.namespace !== expected.namespace ||
        request.subject_public_key !== expected.subject_public_key ||
        request.origin !== expected.origin ||
        request.profile.schema !== expected.profile_schema) {
        throw new Error('request_binding_mismatch');
    }
    if (![request.request_id, request.nonce, request.wallet_signature, request.requested_at, request.request_expires_at]
        .every((value) => typeof value === 'string' && value.trim().length > 0)) {
        throw new Error('invalid_request');
    }
    const requestedAt = Date.parse(request.requested_at);
    const expiresAt = Date.parse(request.request_expires_at);
    const now = (expected.now ? expected.now() : new Date()).getTime();
    if (!Number.isFinite(now) || !Number.isFinite(requestedAt) || !Number.isFinite(expiresAt) || requestedAt >= expiresAt) {
        throw new Error('invalid_request');
    }
    if (now >= expiresAt) {
        throw new Error('credential_request_expired');
    }
}
export async function requestCredentialWithCastaliaWallet(input) {
    if (!(await input.provider.isAvailable())) {
        throw new Error('Castalia Wallet provider is not available');
    }
    return input.provider.requestCredential({
        namespace: input.namespace,
        profile: input.profile,
        request_expires_at: input.request_expires_at,
        nonce: input.nonce,
    });
}
export async function useCredentialWithCastaliaWallet(input) {
    if (!(await input.provider.isAvailable())) {
        return {
            schema: 'castalia.credential-use-result.v1',
            schema_version: 1,
            state: 'unavailable',
            reason: 'provider_unavailable',
        };
    }
    const result = await input.provider.useCredential(input.request);
    if (!isRecord(result) || result.schema !== 'castalia.credential-use-result.v1' || result.schema_version !== 1 ||
        !['approved', 'denied', 'unavailable'].includes(result.state)) {
        throw new Error('invalid_credential_use_result');
    }
    if (result.state === 'approved' && (typeof result.credential !== 'string' || result.credential.trim().length === 0 ||
        typeof result.expires_at !== 'string' || !Number.isFinite(Date.parse(result.expires_at)))) {
        throw new Error('invalid_credential_use_result');
    }
    if (result.state !== 'approved' && result.credential !== undefined) {
        throw new Error('invalid_credential_use_result');
    }
    return result;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function createWalletAuthChallenge(input) {
    const now = input.now ? input.now() : new Date();
    const ttlMs = input.ttlMs ?? 300_000;
    const expiresAt = new Date(now.getTime() + ttlMs);
    if (!input.nonce || input.nonce.trim().length === 0) {
        throw new Error('wallet auth challenge nonce is required');
    }
    if (!input.origin || input.origin.trim().length === 0) {
        throw new Error('wallet auth challenge origin is required');
    }
    if (!input.audience || input.audience.trim().length === 0) {
        throw new Error('wallet auth challenge audience is required');
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
    };
}
export async function authenticateWithCastaliaWallet(input) {
    const available = await input.provider.isAvailable();
    if (!available) {
        throw new Error('Castalia Wallet provider is not available');
    }
    const presentation = await input.provider.signChallenge(input.challenge);
    return verifyWalletPresentation({
        presentation,
        expectedChallenge: input.challenge,
        now: input.now,
        verifySignature: input.verifySignature,
    });
}
export function verifyWalletPresentation(input) {
    assertChallengeMatches(input.presentation.challenge, input.expectedChallenge);
    assertChallengeFresh(input.expectedChallenge, input.now ? input.now() : new Date());
    const verified = input.verifySignature({
        publicKey: input.presentation.subject.publicKey,
        challenge: input.expectedChallenge,
        signature: input.presentation.signature,
    });
    if (!verified) {
        throw new Error('Castalia Wallet signature verification failed');
    }
    return {
        subjectId: input.presentation.subject.subjectId,
        publicKey: input.presentation.subject.publicKey,
        walletKind: input.presentation.subject.walletKind,
        challenge: input.expectedChallenge,
    };
}
function assertChallengeFresh(challenge, now) {
    const expiresAt = Date.parse(challenge.expiresAt);
    if (!Number.isFinite(expiresAt)) {
        throw new Error('Castalia Wallet challenge expiresAt is invalid');
    }
    if (now.getTime() > expiresAt) {
        throw new Error('Castalia Wallet challenge expired');
    }
}
function assertChallengeMatches(actual, expected) {
    const fields = [
        'domain',
        'version',
        'nonce',
        'origin',
        'audience',
        'operation',
        'issuedAt',
        'expiresAt',
    ];
    for (const field of fields) {
        if (actual[field] !== expected[field]) {
            throw new Error(`Castalia Wallet challenge ${field} mismatch`);
        }
    }
}
