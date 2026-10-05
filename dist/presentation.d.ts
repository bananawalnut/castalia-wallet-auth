/** Application-neutral credential-bound presentations. Signatures require custody/issuer verification. */
export declare const CREDENTIAL_SIGNATURE_DOMAIN = "castalia.request-credential.v1/signature\0";
export declare const PRESENTATION_SIGNATURE_DOMAIN = "castalia.credential-presentation.v2/signature\0";
export declare const PRESENTATION_CAPABILITY: "credential_presentation_v2";
export declare const PRESENTATION_LIMITS: {
    readonly requestBytes: 131072;
    readonly envelopeBytes: 262144;
    readonly statements: 144;
    readonly statementBytes: 512;
    readonly preparationSeconds: 120;
    readonly presentationSeconds: 60;
};
export type PresentationCaller = {
    kind: 'browser' | 'terminal';
    id: string;
};
export type PresentationDisclosure = {
    title: string;
    statements: string[];
};
export type RequestCredentialClaims = {
    schema: 'castalia.request-credential.v1';
    issuer: string;
    key_id: string;
    holder_public_key: string;
    audience: string;
    caller: PresentationCaller;
    request_digest_sha256: string;
    disclosure_digest_sha256: string;
    policy_digest_sha256: string;
    nonce: string;
    issued_at: number;
    expires_at: number;
};
export type RequestCredential = {
    claims: RequestCredentialClaims;
    signature: string;
};
export type CredentialPresentationRequestV2 = {
    schema: 'castalia.credential-presentation-request.v2';
    request_bytes_base64: string;
    disclosure: PresentationDisclosure;
    credential: RequestCredential;
};
export type CredentialPresentationV2 = {
    schema: 'castalia.credential-presentation.v2';
    holder_public_key: string;
    issuer: string;
    key_id: string;
    audience: string;
    caller: PresentationCaller;
    request_digest_sha256: string;
    credential_digest_sha256: string;
    disclosure_digest_sha256: string;
    nonce: string;
    issued_at: number;
    expires_at: number;
    signature: string;
};
export type PresentationTrustPin = {
    issuer: string;
    key_id: string;
    public_key: string;
    audience: string;
    callers: PresentationCaller[];
};
export type PresentationTrustConfig = {
    schema: 'castalia.wallet-presentation-trust.v1';
    caller: PresentationCaller;
    pins: PresentationTrustPin[];
};
export type CredentialPresentationResultV2 = {
    state: 'approved';
    presentation: CredentialPresentationV2;
} | {
    state: 'denied' | 'unavailable';
    reason: string;
};
export type CredentialPresentationProvider = {
    getCapabilities(): Promise<readonly string[]>;
    presentCredential(request: CredentialPresentationRequestV2): Promise<CredentialPresentationResultV2>;
};
/** Fixed-shape wire values use ASCII field names and safe integer times; arbitrary JSON signing is not an API. */
export declare function canonicalPresentationJson(value: unknown): string;
/** Structural/time validation only. This does not verify signatures, digests, issuer trust or authority. */
export declare function assertPresentationRequest(value: unknown, now: number): asserts value is CredentialPresentationRequestV2;
/** Structural/time validation only; verify the fixed-domain signature independently. */
export declare function assertCredentialPresentation(value: unknown, now: number): asserts value is CredentialPresentationV2;
export declare function credentialTranscript(claims: RequestCredentialClaims): string;
export declare function presentationTranscript(presentation: CredentialPresentationV2): string;
export declare function presentCredentialWithWallet(provider: CredentialPresentationProvider, request: CredentialPresentationRequestV2): Promise<CredentialPresentationResultV2>;
