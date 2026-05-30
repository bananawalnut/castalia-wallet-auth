export type CastaliaWalletKind = 'castalia-dregg';
export type CastaliaWalletOperation = 'castalia.wallet.signChallenge';
export type CastaliaWalletChallenge = {
    domain: 'castalia-wallet';
    version: 1;
    nonce: string;
    origin: string;
    audience: string;
    operation: CastaliaWalletOperation;
    issuedAt: string;
    expiresAt: string;
};
export type CastaliaWalletSubject = {
    subjectId: string;
    publicKey: string;
    walletKind: CastaliaWalletKind;
};
export type CastaliaWalletSignaturePresentation = {
    subject: CastaliaWalletSubject;
    challenge: CastaliaWalletChallenge;
    signature: string;
    signatureAlgorithm: 'ed25519' | 'node-ed25519';
};
export type CastaliaWalletProvider = {
    isAvailable(): Promise<boolean>;
    getSubject(): Promise<CastaliaWalletSubject>;
    signChallenge(input: CastaliaWalletChallenge): Promise<CastaliaWalletSignaturePresentation>;
};
export type CreateWalletAuthChallengeInput = {
    nonce: string;
    origin: string;
    audience: string;
    now?: () => Date;
    ttlMs?: number;
};
export type VerifyWalletPresentationInput = {
    presentation: CastaliaWalletSignaturePresentation;
    expectedChallenge: CastaliaWalletChallenge;
    now?: () => Date;
    verifySignature(input: {
        publicKey: string;
        challenge: CastaliaWalletChallenge;
        signature: string;
    }): boolean;
};
export type VerifiedWalletPresentation = {
    subjectId: string;
    publicKey: string;
    walletKind: CastaliaWalletKind;
    challenge: CastaliaWalletChallenge;
};
export type AuthenticateWithCastaliaWalletInput = {
    provider: CastaliaWalletProvider;
    challenge: CastaliaWalletChallenge;
    now?: VerifyWalletPresentationInput['now'];
    verifySignature: VerifyWalletPresentationInput['verifySignature'];
};
export declare function createWalletAuthChallenge(input: CreateWalletAuthChallengeInput): CastaliaWalletChallenge;
export declare function authenticateWithCastaliaWallet(input: AuthenticateWithCastaliaWalletInput): Promise<VerifiedWalletPresentation>;
export declare function verifyWalletPresentation(input: VerifyWalletPresentationInput): VerifiedWalletPresentation;
