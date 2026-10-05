import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash,createPrivateKey,createPublicKey,sign,verify } from 'node:crypto'
import { assertPresentationRequest,assertCredentialPresentation,canonicalPresentationJson,credentialTranscript,presentationTranscript,presentCredentialWithWallet } from '../src/presentation.js'
const key=createPrivateKey({key:Buffer.from('302e020100300506032b657004220420'+'11'.repeat(32),'hex'),format:'der',type:'pkcs8'})
const pub=createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32).toString('hex')
const hash=(v:unknown)=>createHash('sha256').update(canonicalPresentationJson(v)).digest('hex')
function request(){const disclosure={title:'Independent application',statements:['Store document revision 4 — café']};const claims={schema:'castalia.request-credential.v1' as const,issuer:'example-issuer',key_id:'key1',holder_public_key:pub,audience:'example://documents',caller:{kind:'browser' as const,id:'https://example.test'},request_digest_sha256:createHash('sha256').update('request').digest('hex'),disclosure_digest_sha256:hash(disclosure),policy_digest_sha256:'aa'.repeat(32),nonce:'bb'.repeat(16),issued_at:100,expires_at:220};return {schema:'castalia.credential-presentation-request.v2' as const,request_bytes_base64:Buffer.from('request').toString('base64'),disclosure,credential:{claims,signature:sign(null,Buffer.from(credentialTranscript(claims)),key).toString('hex')}}}
test('generic fixed transcripts verify independently without application operations',()=>{const r=request();assertPresentationRequest(r,110);assert(verify(null,Buffer.from(credentialTranscript(r.credential.claims)),createPublicKey(key),Buffer.from(r.credential.signature,'hex')));const c=r.credential.claims;const p={schema:'castalia.credential-presentation.v2' as const,holder_public_key:pub,issuer:c.issuer,key_id:c.key_id,audience:c.audience,caller:c.caller,request_digest_sha256:c.request_digest_sha256,credential_digest_sha256:hash(r.credential),disclosure_digest_sha256:c.disclosure_digest_sha256,nonce:'cc'.repeat(16),issued_at:110,expires_at:170,signature:''};p.signature=sign(null,Buffer.from(presentationTranscript(p)),key).toString('hex');assertCredentialPresentation(p,110);assert(verify(null,Buffer.from(presentationTranscript(p)),createPublicKey(key),Buffer.from(p.signature,'hex')));assert(!verify(null,Buffer.from(presentationTranscript({...p,audience:'other'})),createPublicKey(key),Buffer.from(p.signature,'hex')))})
test('unknown fields, versions, malformed encodings and unsafe display are rejected',()=>{for(const mutate of [(r:any)=>r.extra=true,(r:any)=>r.credential.claims.extra=true,(r:any)=>r.schema='v3',(r:any)=>r.request_bytes_base64='AB==',(r:any)=>r.disclosure.title='spoof\u202e',(r:any)=>r.disclosure.title='spoof\u061c',(r:any)=>r.disclosure.title='\ud800',(r:any)=>r.credential.claims.nonce='AA'.repeat(16),(r:any)=>r.credential.claims.issued_at=110.5,(r:any)=>r.credential.claims.expires_at=221]){const r=request();mutate(r);assert.throws(()=>assertPresentationRequest(r,110))}})
test('expired, future and unknown credential declarations fail closed',()=>{const r=request();assert.throws(()=>assertPresentationRequest(r,220));assert.throws(()=>assertPresentationRequest(r,99));r.credential.claims.schema='unknown' as any;assert.throws(()=>assertPresentationRequest(r,110))})
test('capability mismatch never invokes signer or downgrades',async()=>{let used=false;const result=await presentCredentialWithWallet({getCapabilities:async()=>[],presentCredential:async()=>{used=true;return {state:'denied',reason:'test'}}},request());assert.equal(result.state,'unavailable');assert.equal(used,false)})

import { readFileSync } from 'node:fs'
test('Rust vector canonical bytes and both signatures match independently',()=>{
 const v=JSON.parse(readFileSync(new URL('../fixtures/credential-presentation-v2.json',import.meta.url),'utf8'))
 assertPresentationRequest(v.request,v.now);assertCredentialPresentation(v.expected_presentation,v.approved_at)
 assert.equal(canonicalPresentationJson(v.request),v.canonical_request)
 assert.equal(canonicalPresentationJson(v.expected_presentation),v.canonical_presentation)
 assert.equal(Buffer.from(credentialTranscript(v.request.credential.claims)).toString('hex'),v.credential_signing_bytes_hex)
 assert.equal(Buffer.from(presentationTranscript(v.expected_presentation)).toString('hex'),v.presentation_signing_bytes_hex)
 const publicKey=(hex:string)=>createPublicKey({key:Buffer.from('302a300506032b6570032100'+hex,'hex'),format:'der',type:'spki'})
 assert(verify(null,Buffer.from(credentialTranscript(v.request.credential.claims)),publicKey(v.trust_config.pins[0].public_key),Buffer.from(v.request.credential.signature,'hex')))
 assert(verify(null,Buffer.from(presentationTranscript(v.expected_presentation)),publicKey(v.expected_presentation.holder_public_key),Buffer.from(v.expected_presentation.signature,'hex')))
 assert.equal(hash(v.request.credential),v.expected_presentation.credential_digest_sha256)
 assert.equal(hash(v.request.disclosure),v.expected_presentation.disclosure_digest_sha256)
})

test('sparse arrays and undeclared denial payloads fail structural validation',async()=>{
 const r=request();r.disclosure.statements=new Array(1);assert.throws(()=>assertPresentationRequest(r,110));assert.throws(()=>canonicalPresentationJson(new Array(1)))
 const fresh=request();fresh.credential.claims.issued_at=Math.floor(Date.now()/1000);fresh.credential.claims.expires_at=fresh.credential.claims.issued_at+120
 await assert.rejects(presentCredentialWithWallet({getCapabilities:async()=>['credential_presentation_v2'],presentCredential:async()=>({state:'denied',reason:'denied',credential:'unexpected'} as any)},fresh),/invalid_shape/)
 await assert.rejects(presentCredentialWithWallet({getCapabilities:async()=>['credential_presentation_v2'],presentCredential:async()=>({state:'approved',presentation:{}} as any)},fresh),/invalid_shape/)
})
