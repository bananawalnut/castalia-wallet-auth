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
