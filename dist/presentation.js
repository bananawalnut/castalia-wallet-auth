/** Application-neutral credential-bound presentations. Signatures require custody/issuer verification. */
export const CREDENTIAL_SIGNATURE_DOMAIN = 'castalia.request-credential.v1/signature\0';
export const PRESENTATION_SIGNATURE_DOMAIN = 'castalia.credential-presentation.v2/signature\0';
export const PRESENTATION_CAPABILITY = 'credential_presentation_v2';
export const PRESENTATION_LIMITS = { requestBytes: 131072, envelopeBytes: 262144, statements: 144, statementBytes: 512, preparationSeconds: 120, presentationSeconds: 60 };
/** Fixed-shape wire values use ASCII field names and safe integer times; arbitrary JSON signing is not an API. */
export function canonicalPresentationJson(value) {
    if (value === null || typeof value === 'boolean')
        return JSON.stringify(value);
    if (typeof value === 'string') {
        scalarString(value);
        return JSON.stringify(value);
    }
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
        return String(value);
    if (Array.isArray(value))
        return '[' + value.map(canonicalPresentationJson).join(',') + ']';
    if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
        return '{' + Object.keys(value).sort().map(key => {
            if (!/^[a-z][a-z0-9_]*$/.test(key))
                throw new Error('invalid_field_name');
            return JSON.stringify(key) + ':' + canonicalPresentationJson(value[key]);
        }).join(',') + '}';
    }
    throw new Error('invalid_canonical_value');
}
function scalarString(value) {
    for (let i = 0; i < value.length; i++) {
        const n = value.charCodeAt(i);
        if (n >= 0xd800 && n <= 0xdbff) {
            const next = value.charCodeAt(++i);
            if (!(next >= 0xdc00 && next <= 0xdfff))
                throw new Error('invalid_unicode');
        }
        else if (n >= 0xdc00 && n <= 0xdfff)
            throw new Error('invalid_unicode');
    }
}
function byteLength(value) { scalarString(value); let n = 0; for (const c of value) {
    const p = c.codePointAt(0);
    n += p < 128 ? 1 : p < 2048 ? 2 : p < 65536 ? 3 : 4;
} return n; }
function shape(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join(',') !== [...keys].sort().join(','))
        throw new Error('invalid_shape');
}
function text(value, max, ascii = false) {
    if (typeof value !== 'string' || byteLength(value) < 1 || byteLength(value) > max || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(value) || ascii && !/^[\x20-\x7e]+$/.test(value))
        throw new Error('invalid_text');
}
function hex(value, bytes) { if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value))
    throw new Error('invalid_hex'); }
function caller(value) {
    shape(value, ['kind', 'id']);
    text(value.id, 200, true);
    if (!['browser', 'terminal'].includes(value.kind))
        throw new Error('invalid_caller');
    // Exact canonical browser-origin validation is mandatory in custody and authority; no URL global is needed by this types package.
}
function interval(value, max, now) {
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(value.issued_at) || !Number.isSafeInteger(value.expires_at) || value.issued_at < 0 || value.issued_at > now || value.expires_at <= now || value.expires_at - value.issued_at > max)
        throw new Error('invalid_validity');
}
const CLAIM_KEYS = ['schema', 'issuer', 'key_id', 'holder_public_key', 'audience', 'caller', 'request_digest_sha256', 'disclosure_digest_sha256', 'policy_digest_sha256', 'nonce', 'issued_at', 'expires_at'];
const PRESENTATION_KEYS = ['schema', 'holder_public_key', 'issuer', 'key_id', 'audience', 'caller', 'request_digest_sha256', 'credential_digest_sha256', 'disclosure_digest_sha256', 'nonce', 'issued_at', 'expires_at', 'signature'];
/** Structural/time validation only. This does not verify signatures, digests, issuer trust or authority. */
export function assertPresentationRequest(value, now) {
    shape(value, ['schema', 'request_bytes_base64', 'disclosure', 'credential']);
    if (value.schema !== 'castalia.credential-presentation-request.v2')
        throw new Error('unsupported_version');
    const bytes = value.request_bytes_base64;
    if (typeof bytes !== 'string' || bytes.length === 0 || bytes.length > 174764 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bytes))
        throw new Error('invalid_request_bytes');
    const decodedLength = bytes.length / 4 * 3 - (bytes.endsWith('==') ? 2 : bytes.endsWith('=') ? 1 : 0);
    if (decodedLength > PRESENTATION_LIMITS.requestBytes)
        throw new Error('request_too_large');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    if (bytes.endsWith('==') && (alphabet.indexOf(bytes[bytes.length - 3]) & 15) !== 0 || bytes.endsWith('=') && !bytes.endsWith('==') && (alphabet.indexOf(bytes[bytes.length - 2]) & 3) !== 0)
        throw new Error('noncanonical_base64');
    shape(value.disclosure, ['title', 'statements']);
    text(value.disclosure.title, 160);
    const statements = value.disclosure.statements;
    if (!Array.isArray(statements) || statements.length < 1 || statements.length > PRESENTATION_LIMITS.statements)
        throw new Error('invalid_disclosure');
    statements.forEach(statement => text(statement, PRESENTATION_LIMITS.statementBytes));
    shape(value.credential, ['claims', 'signature']);
    hex(value.credential.signature, 64);
    const c = value.credential.claims;
    shape(c, CLAIM_KEYS);
    if (c.schema !== 'castalia.request-credential.v1')
        throw new Error('unsupported_credential');
    for (const key of ['issuer', 'key_id', 'audience'])
        text(c[key], 200, true);
    for (const key of ['holder_public_key', 'request_digest_sha256', 'disclosure_digest_sha256', 'policy_digest_sha256'])
        hex(c[key], 32);
    hex(c.nonce, 16);
    caller(c.caller);
    interval(c, 120, now);
    if (byteLength(canonicalPresentationJson(value)) > PRESENTATION_LIMITS.envelopeBytes)
        throw new Error('request_too_large');
}
/** Structural/time validation only; verify the fixed-domain signature independently. */
export function assertCredentialPresentation(value, now) {
    shape(value, PRESENTATION_KEYS);
    if (value.schema !== 'castalia.credential-presentation.v2')
        throw new Error('unsupported_version');
    for (const key of ['issuer', 'key_id', 'audience'])
        text(value[key], 200, true);
    for (const key of ['holder_public_key', 'request_digest_sha256', 'credential_digest_sha256', 'disclosure_digest_sha256'])
        hex(value[key], 32);
    hex(value.nonce, 16);
    hex(value.signature, 64);
    caller(value.caller);
    interval(value, 60, now);
}
export function credentialTranscript(claims) { return CREDENTIAL_SIGNATURE_DOMAIN + canonicalPresentationJson(claims); }
export function presentationTranscript(presentation) { const { signature: _signature, ...unsigned } = presentation; return PRESENTATION_SIGNATURE_DOMAIN + canonicalPresentationJson(unsigned); }
export async function presentCredentialWithWallet(provider, request) {
    if (!(await provider.getCapabilities()).includes(PRESENTATION_CAPABILITY))
        return { state: 'unavailable', reason: 'unsupported_version' };
    return provider.presentCredential(request);
}
