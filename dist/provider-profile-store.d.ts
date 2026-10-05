import { type ProviderProfileV1, type MembershipRootV1 } from './provider-profiles.js';
import type { PresentationTrustPin } from './presentation.js';
export type StoredProviderProfile = {
    id: string;
    revision: number;
    active: boolean;
    profile: ProviderProfileV1;
};
type CredentialRecord = {
    profileId: string;
    holder: string;
    digest: string;
    credential: any;
};
type ProfileState = {
    schema: 'castalia.wallet-provider-state.v1';
    revision: number;
    profiles: StoredProviderProfile[];
    legacy: Record<string, string>;
    credentials: CredentialRecord[];
};
type Dependencies = {
    read(): Promise<unknown>;
    write(value: ProfileState): Promise<void>;
    randomId(): string;
    digest(bytes: string): Promise<string>;
    verifyMembership(credential: unknown, roots: MembershipRootV1[], holder: string): Promise<any>;
};
/** Trusted UI calls mutations. This store never authorizes requests or accepts app-supplied trust itself. */
export declare function createProviderProfileStore(deps: Dependencies): {
    subscribe(listener: () => void): () => void;
    snapshot: () => Promise<ProfileState>;
    get(profileId: string, origin?: string): Promise<StoredProviderProfile>;
    list(origin: string): Promise<{
        profileId: string;
        revision: number;
        displayName: string;
        protocol: "castalia.zenith-membership.v3";
        issuerOrigin: string;
    }[]>;
    approve(input: unknown, edit?: {
        id: string;
        expectedRevision: number;
    }): Promise<StoredProviderProfile>;
    remove(profileId: string, expectedRevision: number): Promise<{
        removed: boolean;
    }>;
    bindLegacy(origin: string, profileId: string, expectedRevision: number): Promise<{
        bound: boolean;
    }>;
    legacy(origin: string): Promise<StoredProviderProfile>;
    presentationPins(): Promise<PresentationTrustPin[]>;
    saveCredential(profileId: string, expectedRevision: number, input: unknown, holder: string): Promise<any>;
    credential(profileId: string, origin: string, holder: string, legacy?: unknown): Promise<any>;
    clearIdentity(): Promise<{
        cleared: boolean;
    }>;
};
export {};
