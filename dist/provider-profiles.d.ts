import type { PresentationTrustPin } from './presentation.js';
export declare const PROVIDER_PROFILE_CAPABILITIES: readonly ["provider_profiles_v1", "connection_v1", "membership_profiles_v1", "registration_proposal_v2"];
export declare const PROFILE_LIMITS: {
    readonly bytes: 65536;
    readonly profiles: 64;
    readonly roots: 64;
    readonly origins: 64;
    readonly pins: 64;
    readonly credentials: 256;
};
export type MembershipRootV1 = {
    issuerId: string;
    keyId: string;
    signatureSuite: 'Ed25519';
    publicKey: string;
};
export type ProviderProfileV1 = {
    schema: 'castalia.provider-profile.v1';
    display_name: string;
    origins: string[];
    membership: {
        protocol: 'castalia.zenith-membership.v3';
        issuer_origin: string;
        roots: MembershipRootV1[];
    } | null;
    presentations: PresentationTrustPin[];
};
export type MembershipProfileSummaryV1 = {
    profileId: string;
    revision: number;
    displayName: string;
    protocol: 'castalia.zenith-membership.v3';
    issuerOrigin: string;
};
export interface ProviderProfilesProvider {
    getCapabilities(): Promise<readonly string[]>;
    requestConnection(): Promise<{
        state: 'connected';
    }>;
    proposeProviderProfile(profile: ProviderProfileV1): Promise<{
        state: 'approved' | 'denied';
    }>;
    listMembershipProfiles(): Promise<MembershipProfileSummaryV1[]>;
    requestMembership(input: {
        profileId: string;
    }): Promise<unknown>;
    getMembershipCredential(input: {
        profileId: string;
    }): Promise<unknown>;
}
export declare function profileOrigin(value: unknown, allowLoopback?: boolean): string;
/** Parsing a profile establishes neither key ownership nor trust. Only trusted Wallet UI may activate it. */
export declare function parseProviderProfile(input: unknown): ProviderProfileV1;
/** Canonical configuration bytes for local revision comparison; not a signing transcript. */
export declare function providerProfileBytes(input: unknown): string;
/** Additive transport version. Request and result remain the receiver's existing typed registration contract. */
export interface RegistrationProposalProviderV2<Request, Result> {
    getCapabilities(): Promise<readonly string[]>;
    requestRegistrationV2(request: Request): Promise<Result>;
}
