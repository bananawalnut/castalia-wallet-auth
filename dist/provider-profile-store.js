import { parseProviderProfile, profileOrigin, providerProfileBytes, PROFILE_LIMITS } from './provider-profiles.js';
import { canonicalPresentationJson } from './presentation.js';
const clone = (v) => JSON.parse(JSON.stringify(v));
function revision(v) { if (!Number.isSafeInteger(v) || v < 0)
    throw new Error('invalid_profile_revision'); }
function id(v) { if (typeof v !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(v))
    throw new Error('invalid_profile_id'); }
function exact(v, keys) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype || Object.keys(v).sort().join(',') !== keys.sort().join(','))
        throw new Error('invalid_provider_state');
}
function empty() { return { schema: 'castalia.wallet-provider-state.v1', revision: 0, profiles: [], legacy: {}, credentials: [] }; }
function parse(value) {
    if (value === undefined || value === null)
        return empty();
    exact(value, ['schema', 'revision', 'profiles', 'legacy', 'credentials']);
    if (value.schema !== 'castalia.wallet-provider-state.v1')
        throw new Error('unsupported_provider_state');
    revision(value.revision);
    if (!Array.isArray(value.profiles) || value.profiles.length > PROFILE_LIMITS.profiles || !Array.isArray(value.credentials) || value.credentials.length > PROFILE_LIMITS.credentials)
        throw new Error('provider_capacity');
    const ids = new Set();
    for (const p of value.profiles) {
        exact(p, ['id', 'revision', 'active', 'profile']);
        id(p.id);
        revision(p.revision);
        if (p.revision < 1 || typeof p.active !== 'boolean' || ids.has(p.id))
            throw new Error('invalid_provider_state');
        ids.add(p.id);
        parseProviderProfile(p.profile);
    }
    if (!value.legacy || typeof value.legacy !== 'object' || Array.isArray(value.legacy) || Object.keys(value.legacy).length > 256)
        throw new Error('invalid_provider_state');
    for (const [origin, profileId] of Object.entries(value.legacy)) {
        profileOrigin(origin);
        id(profileId);
        if (!ids.has(profileId))
            throw new Error('invalid_legacy_profile');
    }
    for (const c of value.credentials) {
        exact(c, ['profileId', 'holder', 'digest', 'credential']);
        id(c.profileId);
        if (!ids.has(c.profileId) || typeof c.holder !== 'string' || !/^[a-f0-9]{64}$/.test(c.holder) || typeof c.digest !== 'string' || c.digest.length > 8192 || !c.credential || JSON.stringify(c.credential).length > 8192)
            throw new Error('invalid_stored_credential');
    }
    return clone(value);
}
function selected(state, profileId, origin) {
    const p = state.profiles.find(p => p.id === profileId && p.active);
    if (!p || origin !== undefined && !p.profile.origins.includes(profileOrigin(origin)))
        throw new Error('profile_unavailable');
    return p;
}
function conflicts(profiles) {
    const roots = new Map();
    for (const p of profiles.filter(p => p.active)) {
        const pins = [...(p.profile.membership?.roots ?? []).map(r => ({ id: JSON.stringify(['membership', r.issuerId, r.keyId]), key: r.publicKey })), ...p.profile.presentations.map(r => ({ id: JSON.stringify(['presentation', r.issuer, r.key_id, r.audience]), key: r.public_key }))];
        for (const { id, key } of pins) {
            const old = roots.get(id);
            if (old && old !== key)
                throw new Error('conflicting_provider_key');
            roots.set(id, key);
        }
    }
}
/** Trusted UI calls mutations. This store never authorizes requests or accepts app-supplied trust itself. */
export function createProviderProfileStore(deps) {
    let tail = Promise.resolve();
    const listeners = new Set();
    const read = async () => parse(await deps.read());
    const mutate = (fn, invalidate = true) => {
        const result = tail.then(async () => { const state = await read(); const output = await fn(state); state.revision++; revision(state.revision); conflicts(state.profiles); await deps.write(parse(state)); if (invalidate)
            for (const f of listeners) {
                try {
                    f();
                }
                catch { }
            } ; return clone(output); });
        tail = result.then(() => { }, () => { });
        return result;
    };
    return {
        subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        snapshot: read,
        async get(profileId, origin) { return selected(await read(), profileId, origin); },
        async list(origin) { return (await read()).profiles.filter(p => p.active && p.profile.membership && p.profile.origins.includes(profileOrigin(origin))).map(p => ({ profileId: p.id, revision: p.revision, displayName: p.profile.display_name, protocol: p.profile.membership.protocol, issuerOrigin: p.profile.membership.issuer_origin })); },
        approve(input, edit) {
            const profile = parseProviderProfile(input);
            return mutate(state => {
                let p;
                if (edit) {
                    p = state.profiles.find(p => p.id === edit.id);
                    if (!p || p.revision !== edit.expectedRevision)
                        throw new Error('stale_profile_revision');
                }
                else
                    p = state.profiles.find(p => providerProfileBytes(p.profile) === providerProfileBytes(profile));
                if (p) {
                    p.profile = profile;
                    p.active = true;
                    p.revision++;
                }
                else {
                    if (state.profiles.length >= PROFILE_LIMITS.profiles)
                        throw new Error('provider_capacity');
                    p = { id: deps.randomId(), revision: 1, active: true, profile };
                    id(p.id);
                    state.profiles.push(p);
                }
                return p;
            });
        },
        remove(profileId, expectedRevision) { return mutate(state => { const p = selected(state, profileId); if (p.revision !== expectedRevision)
            throw new Error('stale_profile_revision'); p.active = false; p.revision++; return { removed: true }; }); },
        bindLegacy(origin, profileId, expectedRevision) { return mutate(state => { const p = selected(state, profileId, origin); if (p.revision !== expectedRevision || !p.profile.membership)
            throw new Error('stale_profile_revision'); state.legacy[origin] = profileId; return { bound: true }; }); },
        async legacy(origin) { const state = await read(); return selected(state, state.legacy[profileOrigin(origin)], origin); },
        async presentationPins() {
            const state = await read();
            conflicts(state.profiles);
            const pins = new Map();
            for (const p of state.profiles.filter(p => p.active))
                for (const pin of p.profile.presentations) {
                    const key = JSON.stringify([pin.issuer, pin.key_id, pin.audience]);
                    const old = pins.get(key);
                    if (old) {
                        for (const c of pin.callers)
                            if (!old.callers.some(o => o.kind === c.kind && o.id === c.id))
                                old.callers.push(c);
                    }
                    else
                        pins.set(key, clone(pin));
                }
            if (pins.size > PROFILE_LIMITS.pins || [...pins.values()].some(p => p.callers.length > PROFILE_LIMITS.origins))
                throw new Error('provider_capacity');
            return [...pins.values()];
        },
        async saveCredential(profileId, expectedRevision, input, holder) {
            return mutate(async (state) => {
                const p = selected(state, profileId);
                if (p.revision !== expectedRevision || !p.profile.membership)
                    throw new Error('stale_profile_revision');
                const credential = await deps.verifyMembership(input, p.profile.membership.roots, holder);
                const digest = await deps.digest(canonicalPresentationJson(credential));
                if (!state.credentials.some(c => c.profileId === profileId && c.holder === holder && c.digest === digest)) {
                    if (state.credentials.length >= PROFILE_LIMITS.credentials)
                        throw new Error('credential_capacity');
                    state.credentials.push({ profileId, holder, digest, credential });
                }
                return credential;
            }, false);
        },
        async credential(profileId, origin, holder, legacy) {
            const state = await read(), p = selected(state, profileId, origin);
            if (!p.profile.membership)
                throw new Error('membership_unavailable');
            for (const c of state.credentials.filter(c => c.profileId === profileId && c.holder === holder).reverse()) {
                if (c.digest !== await deps.digest(canonicalPresentationJson(c.credential)))
                    throw new Error('stored_credential_digest_mismatch');
                try {
                    return await deps.verifyMembership(c.credential, p.profile.membership.roots, holder);
                }
                catch { /* A removed root cannot establish current trust. */ }
            }
            if (legacy !== undefined && legacy !== null)
                return deps.verifyMembership(legacy, p.profile.membership.roots, holder);
            throw new Error('membership_unavailable');
        },
        clearIdentity() { return mutate(state => { state.credentials = []; state.legacy = {}; return { cleared: true }; }); },
    };
}
