# Implementation contract: generic credential-bound presentation
All object shapes are closed, snake_case, and canonical JSON is UTF-8 with lexicographically sorted ASCII field names, no whitespace, integer Unix seconds (0..2^53-1), standard JSON string escaping; reject duplicate keys at Rust/Python ingress, noncanonical base64, noncanonical hex, noninteger times, unknown fields. Never normalize signed strings. Unicode scalar strings only. Fixed schemas/domains below. SHA256 encoded lowercase64hex; keys32bytes/signatures64bytes lowercasehex. Request bytes max131072; entire request max262144. No executable profiles.

Caller = {kind:"browser"|"terminal",id:string}; browser id canonical exact http(s) origin (http loopback only), terminal id operator-configured identifier, 1..200 printable ASCII. Audience/issuer/key_id 1..200 printable ASCII. Nonce lowercase32hex (16 random bytes). Disclosure = {title:string, statements:string[]}; title1..160 UTF8bytes, statements1..144 each1..512 UTF8bytes. Disallow C0/C1 control chars and U+061C, U+200E/F, U+202A–U+202E, U+2066–U+2069 bidi control formatting in all display strings; text rendering only.

CredentialClaims = {schema:"castalia.request-credential.v1",issuer,key_id,holder_public_key,audience,caller,request_digest_sha256,disclosure_digest_sha256,policy_digest_sha256,nonce,issued_at,expires_at}
Credential = {claims:CredentialClaims,signature:string}
Credential signature bytes = UTF8("castalia.request-credential.v1/signature\0") || canonicalJSON(claims).
Credential validity <=120seconds; futureissued/expired reject; grantedexpiry may shorten.

PresentationRequest = {schema:"castalia.credential-presentation-request.v2",request_bytes_base64:string,disclosure:Disclosure,credential:Credential}
request_digest_sha256 = SHA256(decoded request bytes). Applications own the canonical request representation and must include all execution bindings such as resource versions and idempotency. Custody hashes the exact opaque bytes without interpreting application operations. Existing application v1 bytes remain separate and unchanged.

disclosure_digest_sha256 = SHA256(canonicalJSON(disclosure)).
credential_digest_sha256 = SHA256(canonicalJSON(credential)).

Presentation unsigned = {schema:"castalia.credential-presentation.v2",holder_public_key,issuer,key_id,audience,caller,request_digest_sha256,credential_digest_sha256,disclosure_digest_sha256,nonce,issued_at,expires_at}
Presentation = unsigned + {signature:string}
Presentation signature bytes = UTF8("castalia.credential-presentation.v2/signature\0") || canonicalJSON(unsigned).
Presentation validity<=60seconds and<=credential expiry; fresh randomnonce/currenttime after approval. Receipt/execution includes originalrequest+credential+disclosure+presentation, not signaturealone. Single-ownedpreparation capped120seconds tiedcustodyepoch/identity/instance/caller and credentialexpiry.

TrustPin = {issuer,key_id,public_key,audience,callers:Caller[]} from privileged operator configuration, never request. Generic Rust API takes separate trusted pins and expected caller. Browser service-worker config/package pins and approvedorigin provide that context. Headless loads owner-private trust config and expectedcaller; /dev/tty explicitconfirm eachuse, noTTY approval_required.

Provider method presentCredential(request) and capability credential_presentation_v2. Result typed approved{presentation}, denied, unavailable with reason. WalletAuth publictypes/helpers own contract. No persistent credential install/recovery in scope. secS newv2projection owns app-specific fields, explicit credential/disclosure/presentation digests; closedv1 untouched.

## Ownership and qualification

These helpers validate shape and encode fixed transcripts. They do not establish issuer trust, verify signatures or grant authorization. Wallet custody must verify request/disclosure/credential digests, the issuer signature, caller/holder/audience pins and fresh per-use consent. Receivers independently rederive application bindings and recheck current grants. An ordinary authentication signature cannot substitute.

Credential installation and persistent storage are not part of this contract. Existing authentication and credential v1 interfaces are unchanged; v2 has no implicit downgrade.
