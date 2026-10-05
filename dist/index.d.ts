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
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type CastaliaCredentialProfile = {
    schema: string;
    [key: string]: JsonValue;
};
export type CastaliaCredentialRequestV1 = {
    schema: 'castalia.credential-request.v1';
    schema_version: 1;
    request_id: string;
    namespace: string;
    subject_public_key: string;
    origin: string;
    profile: CastaliaCredentialProfile;
    requested_at: string;
    request_expires_at: string;
    nonce: string;
    wallet_signature: string;
};
export type CastaliaCredentialInstallV1 = {
    schema: 'castalia.credential-install.v1';
    schema_version: 1;
    namespace: string;
    recipient_public_key: string;
    manifest: CastaliaCredentialProfile;
    encrypted_secret: string;
    issuer_signature: string;
};
export type CastaliaCredentialUseV1 = {
    schema: 'castalia.credential-use.v1';
    schema_version: 1;
    namespace: string;
    audience: string;
    resource: string;
    method: 'GET' | 'POST';
    path: string;
    required_scopes: string[];
    reason: string;
};
export type CastaliaCredentialUseResultV1 = {
    schema: 'castalia.credential-use-result.v1';
    schema_version: 1;
    state: 'approved' | 'denied' | 'unavailable';
    credential?: string;
    credential_id?: string;
    version?: number;
    expires_at?: string;
    reason?: string;
};
export type CastaliaCredentialInstallResultV1 = {
    schema: 'castalia.credential-install-result.v1';
    schema_version: 1;
    state: 'installed' | 'rejected' | 'unsupported';
    namespace: string;
    credential_id?: string;
    version?: number;
    reason?: string;
};
export type CastaliaCredentialProvider = CastaliaWalletProvider & {
    requestCredential(input: {
        namespace: string;
        profile: CastaliaCredentialProfile;
        request_expires_at: string;
        nonce: string;
    }): Promise<CastaliaCredentialRequestV1>;
    installCredential(input: CastaliaCredentialInstallV1): Promise<CastaliaCredentialInstallResultV1>;
    useCredential(input: CastaliaCredentialUseV1): Promise<CastaliaCredentialUseResultV1>;
};
export type CastaliaCredentialProfileAdapter<TProfile extends CastaliaCredentialProfile> = {
    readonly schema: TProfile['schema'];
    validate(profile: CastaliaCredentialProfile): TProfile;
};
export declare class UnsupportedCredentialProfileError extends Error {
    readonly code = "unsupported_profile";
    constructor();
}
export declare function resolveCredentialProfile<TProfile extends CastaliaCredentialProfile>(profile: CastaliaCredentialProfile, adapters: ReadonlyArray<CastaliaCredentialProfileAdapter<TProfile>>): TProfile;
export declare function assertCredentialRequestBinding(request: CastaliaCredentialRequestV1, expected: {
    namespace: string;
    subject_public_key: string;
    origin: string;
    profile_schema: string;
    now?: () => Date;
}): void;
export declare function requestCredentialWithCastaliaWallet(input: {
    provider: CastaliaCredentialProvider;
    namespace: string;
    profile: CastaliaCredentialProfile;
    request_expires_at: string;
    nonce: string;
}): Promise<CastaliaCredentialRequestV1>;
export declare function useCredentialWithCastaliaWallet(input: {
    provider: CastaliaCredentialProvider;
    request: CastaliaCredentialUseV1;
}): Promise<CastaliaCredentialUseResultV1>;
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
export * from './presentation.js';
export * from './provider-profiles.js';
export * from './provider-profile-store.js';
